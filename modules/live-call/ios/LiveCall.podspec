Pod::Spec.new do |s|
  s.name           = 'LiveCall'
  s.version        = '1.0.0'
  s.summary        = 'Live call audio channel: one AVAudioEngine with voice processing for speech recognition and PCM playback'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'everylove'
  s.homepage       = 'https://github.com/everylove'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
