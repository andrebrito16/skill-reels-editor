// Gera mattes (PNG cinza) de pessoa para um trecho de vídeo usando Vision.
// Uso: swift roto.swift <video> <startSec> <durSec> <outDir>
import AVFoundation
import CoreImage
import Vision
import Foundation

let args = CommandLine.arguments
guard args.count >= 5 else { print("uso: roto <video> <start> <dur> <outDir>"); exit(1) }
let url = URL(fileURLWithPath: args[1])
let start = Double(args[2])!
let dur = Double(args[3])!
let outDir = args[4]
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: url)
let track = asset.tracks(withMediaType: .video)[0]
let reader = try! AVAssetReader(asset: asset)
reader.timeRange = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600),
                               duration: CMTime(seconds: dur, preferredTimescale: 600))
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(out)
reader.startReading()

let ctx = CIContext()
let seq = VNSequenceRequestHandler()
let gray = CGColorSpaceCreateDeviceGray()
var n = 0
while let sb = out.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
  let req = VNGeneratePersonSegmentationRequest()
  req.qualityLevel = .accurate
  req.outputPixelFormat = kCVPixelFormatType_OneComponent8
  try! seq.perform([req], on: pb)
  guard let mask = req.results?.first?.pixelBuffer else { continue }
  var m = CIImage(cvPixelBuffer: mask)
  let w = CGFloat(CVPixelBufferGetWidth(pb)), h = CGFloat(CVPixelBufferGetHeight(pb))
  m = m.transformed(by: CGAffineTransform(scaleX: w / m.extent.width, y: h / m.extent.height))
  let name = String(format: "%@/m_%05d.png", outDir, n)
  try! ctx.writePNGRepresentation(of: m, to: URL(fileURLWithPath: name), format: .L8, colorSpace: gray)
  n += 1
}
print("frames:", n)
