import AVFoundation
import ExpoModulesCore
import Speech

/**
 通话通道（D-238）：一台 AVAudioEngine 开着系统的通话处理（voice processing = 回声消除 + 降噪），
 麦克风的声音直接喂给 iOS 本机语音识别，TA 的 PCM 也从同一台引擎播出去——
 引擎知道自己在放什么，就能从麦克风里减掉，TA 说话时也能一直听她、她开口就能打断。
 （之前识别与播放是两个库各开一台引擎：同时跑会互相触发重启，也没有回声消除，D-237。）

 JS 侧见 lib/live-voice.ts：open → listen / stopListening（每段话一个识别任务，引擎不停）→ enqueue（24 kHz 16 bit 单声道 PCM，base64）
 → onPlayed（每播完一块，带 generation；stopPlayback 换代，旧代的块作废）→ close。
 */

struct ListenOptions: Record {
  @Field
  var locale: String = "en-US"

  @Field
  var hints: [String] = []
}

internal final class LiveCallException: GenericException<String> {
  override var reason: String {
    "Live call audio failed: \(param)"
  }
}

public class LiveCallModule: Module {
  private var engine: AVAudioEngine?
  private var player: AVAudioPlayerNode?
  private let playFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 24000, channels: 1, interleaved: false)!

  // 麦克风线程要读当前的识别请求；generation 在 JS 线程改、播放回调里读：都过这把锁
  private let lock = NSLock()
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var generation = 0

  private var task: SFSpeechRecognitionTask?
  private var activeSegment = 0
  private var segmentCounter = 0
  private var lastLevelAt: CFTimeInterval = 0
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("LiveCall")

    Events("onText", "onLevel", "onError", "onEnd", "onPlayed")

    AsyncFunction("open") { (speaker: Bool) in
      try self.open(speaker: speaker)
    }.runOnQueue(.main)

    AsyncFunction("listen") { (options: ListenOptions) in
      self.listen(options)
    }.runOnQueue(.main)

    AsyncFunction("stopListening") {
      self.stopListening()
    }.runOnQueue(.main)

    AsyncFunction("close") {
      self.close()
    }.runOnQueue(.main)

    /** 排一块 PCM（base64 的 16 bit 小端单声道 24 kHz），返回它属于哪一代 */
    Function("enqueue") { (pcmBase64: String) -> Int in
      return self.enqueue(pcmBase64)
    }

    /** 掐掉正在放和排着的，换一代；返回新的代号 */
    Function("stopPlayback") { () -> Int in
      return self.stopPlayback()
    }

    Function("setSpeaker") { (on: Bool) in
      do {
        try AVAudioSession.sharedInstance().overrideOutputAudioPort(on ? .speaker : .none)
      } catch {
        print("LiveCall: speaker override failed: \(error)")
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.close()
      }
    }
  }

  // MARK: - 引擎

  private func open(speaker: Bool) throws {
    close()
    let session = AVAudioSession.sharedInstance()
    do {
#if compiler(>=6.2)
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
#else
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
#endif
      try session.setActive(true)
      try session.overrideOutputAudioPort(speaker ? .speaker : .none)
    } catch {
      throw LiveCallException("session: \(error.localizedDescription)")
    }

    let engine = AVAudioEngine()
    let input = engine.inputNode
    do {
      // 打开输入端的 voice processing 会连带输出端一起开：从这台引擎放出去的声音会从麦克风里消掉
      try input.setVoiceProcessingEnabled(true)
    } catch {
      throw LiveCallException("voice processing: \(error.localizedDescription)")
    }

    let player = AVAudioPlayerNode()
    engine.attach(player)
    engine.connect(player, to: engine.mainMixerNode, format: playFormat)

    self.engine = engine
    self.player = player
    try installTap()

    engine.prepare()
    do {
      try engine.start()
    } catch {
      self.engine = nil
      self.player = nil
      throw LiveCallException("engine: \(error.localizedDescription)")
    }
    player.play()
    observe(engine)
  }

  private func installTap() throws {
    guard let engine else { return }
    let input = engine.inputNode
    input.removeTap(onBus: 0)
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      throw LiveCallException("microphone busy")
    }
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.onMicrophone(buffer)
    }
  }

  /** 路由 / 配置变了（插耳机、切免提、来电结束）引擎会自己停：重挂麦克风、重新开 */
  private func restart() {
    guard let engine, let player else { return }
    do {
      try installTap()
      if !engine.isRunning {
        engine.prepare()
        try engine.start()
      }
      if !player.isPlaying {
        player.play()
      }
    } catch {
      sendEvent("onError", ["code": "audio-capture", "message": error.localizedDescription])
    }
  }

  private func observe(_ engine: AVAudioEngine) {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
      self?.restart()
    })
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance(), queue: .main) { [weak self] note in
      guard let self else { return }
      let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
      if raw.flatMap(AVAudioSession.InterruptionType.init(rawValue:)) == .ended {
        try? AVAudioSession.sharedInstance().setActive(true)
        self.restart()
      }
    })
  }

  private func close() {
    stopListening()
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers = []
    lock.lock()
    generation += 1
    lock.unlock()
    player?.stop()
    if let engine {
      engine.inputNode.removeTap(onBus: 0)
      engine.stop()
      try? engine.inputNode.setVoiceProcessingEnabled(false)
    }
    let hadEngine = engine != nil
    engine = nil
    player = nil
    if hadEngine {
      try? AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  // MARK: - 耳朵

  private func onMicrophone(_ buffer: AVAudioPCMBuffer) {
    lock.lock()
    let req = request
    lock.unlock()
    guard let req else { return }
    req.append(buffer)

    let now = CACurrentMediaTime()
    guard now - lastLevelAt >= 0.1 else { return }
    lastLevelAt = now
    let value = Self.level(buffer)
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent("onLevel", ["value": value])
    }
  }

  /** 音量折成 -2～10（0 以下算没声），与之前的识别库同一把尺 */
  private static func level(_ buffer: AVAudioPCMBuffer) -> Double {
    guard let data = buffer.floatChannelData, buffer.frameLength > 0 else { return -2 }
    let samples = data[0]
    let n = Int(buffer.frameLength)
    var sum: Float = 0
    for i in 0..<n {
      sum += samples[i] * samples[i]
    }
    let rms = sqrt(sum / Float(n))
    let db = rms > 0 ? 20 * log10(rms) : -60
    let normalized = min(max((db + 60) / 60, 0), 1)
    return Double(normalized * 12 - 2)
  }

  private func listen(_ options: ListenOptions) {
    stopListening()
    guard engine != nil else {
      sendEvent("onError", ["code": "audio-capture", "message": "channel not open"])
      sendEvent("onEnd")
      return
    }
    guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
      sendEvent("onError", ["code": "not-allowed", "message": "speech recognition not authorized"])
      sendEvent("onEnd")
      return
    }
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: options.locale)), recognizer.isAvailable else {
      sendEvent("onError", ["code": "language-not-supported", "message": options.locale])
      sendEvent("onEnd")
      return
    }

    let req = SFSpeechAudioBufferRecognitionRequest()
    req.shouldReportPartialResults = true
    if recognizer.supportsOnDeviceRecognition {
      req.requiresOnDeviceRecognition = true
    }
    if #available(iOS 16, *) {
      req.addsPunctuation = true
    }
    req.contextualStrings = Array(options.hints.prefix(20))

    segmentCounter += 1
    let segment = segmentCounter
    activeSegment = segment
    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      let text = result?.bestTranscription.formattedString
      let isFinal = result?.isFinal ?? false
      let nsError = error as NSError?
      DispatchQueue.main.async {
        self?.onRecognition(segment: segment, text: text, isFinal: isFinal, error: nsError)
      }
    }
    lock.lock()
    request = req
    lock.unlock()
  }

  private func onRecognition(segment: Int, text: String?, isFinal: Bool, error: NSError?) {
    guard segment == activeSegment else { return }
    if let text {
      sendEvent("onText", ["text": text, "final": isFinal])
    }
    if let error {
      let code = Self.errorCode(error)
      if code != "no-speech" && code != "aborted" {
        sendEvent("onError", ["code": code, "message": error.localizedDescription])
      }
    }
    if isFinal || error != nil {
      finishSegment()
      sendEvent("onEnd")
    }
  }

  private static func errorCode(_ error: NSError) -> String {
    if error.domain == "kAFAssistantErrorDomain" {
      switch error.code {
      case 1110: return "no-speech"
      case 203, 209, 216, 301, 1107: return "aborted"
      case 1700: return "language-not-supported"
      default: return "network"
      }
    }
    return "network"
  }

  /** 识别任务收尾（不发事件） */
  private func finishSegment() {
    activeSegment = 0
    lock.lock()
    let req = request
    request = nil
    lock.unlock()
    req?.endAudio()
    task = nil
  }

  private func stopListening() {
    let running = task
    finishSegment()
    running?.cancel()
  }

  // MARK: - 嘴

  private func enqueue(_ pcmBase64: String) -> Int {
    lock.lock()
    let gen = generation
    lock.unlock()
    guard let player, let data = Data(base64Encoded: pcmBase64) else { return gen }
    let frames = data.count / 2
    guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: playFormat, frameCapacity: AVAudioFrameCount(frames)),
          let out = buffer.floatChannelData?[0] else { return gen }
    buffer.frameLength = AVAudioFrameCount(frames)
    data.withUnsafeBytes { raw in
      for i in 0..<frames {
        let sample = Int16(littleEndian: raw.loadUnaligned(fromByteOffset: i * 2, as: Int16.self))
        out[i] = Float(sample) / 32768
      }
    }
    player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { [weak self] _ in
      DispatchQueue.main.async {
        guard let self else { return }
        self.lock.lock()
        let current = self.generation
        self.lock.unlock()
        if current == gen {
          self.sendEvent("onPlayed", ["generation": gen])
        }
      }
    }
    if !player.isPlaying {
      player.play()
    }
    return gen
  }

  private func stopPlayback() -> Int {
    lock.lock()
    generation += 1
    let gen = generation
    lock.unlock()
    if let player {
      player.stop()
      player.play()
    }
    return gen
  }
}
