// SMPTE Class 14 (Private Use) UL definitions
// These are discovered through reverse engineering, open-source implementations,
// vendor SDKs, and publicly available technical documentation.
//
// Note: This is NOT an official registry. Many Class 14 ULs remain proprietary
// and undocumented. Entries here are sourced from published specifications,
// open-source MXF libraries, camera/equipment technical documentation, and SDKs.
//
// Sources:
// - asdcplib: https://github.com/cinecert/asdcplib
// - mxflib: https://github.com/Tjoppen/mxflib
// - bmx (BBC): https://github.com/bbc/bmx
// - FFmpeg: https://github.com/FFmpeg/FFmpeg
// - Individual vendor SDKs and technical specifications

window.PRIVATE_ULS = {
  // ===== MISB Systems (0e01) =====
  // Expected: sensors, targeting, video motion metadata, etc.
  // Sources: https://www.misb.org

  // ===== ASPA (0e02) =====
  // No known public ULs documented

  // ===== MISB Classified (0e03) =====
  // Restricted/Classified ULs not included

  // ===== Avid Technology Inc. (0e04) =====
  // Known: DNxHR, DNxHD codecs, Avid-specific metadata
  // TODO: Extract from asdcplib/ffmpeg sources

  // ===== CNN (0e05) =====
  // No known public ULs documented

  // ===== Sony Corporation (0e06) =====
  '060e2b34040101060e0604010101060604': {
    name: 'S-Log3 Transfer Characteristic',
    org: 'Sony Corporation',
    class: 14,
    category: 'Transfer Characteristic',
    sources: [
      'Sony camera specifications and SDK documentation'
    ]
  },
  // TODO: S-Log, S-Log2, S-Gamut, XAVC, other Sony codecs/descriptors

  // ===== IdeasUnlimited.TV (0e07) =====
  // No known public ULs documented

  // ===== IPV Ltd (0e08) =====
  // No known public ULs documented

  // ===== Dolby Laboratories Inc. (0e09) =====
  // Known: Dolby Vision, Dolby Atmos metadata
  // TODO: Extract from DolbyVision/Atmos specifications

  // ===== Snell & Wilcox (0e0a) =====
  // Known: routing, timing, video processing metadata
  // TODO: Technical documentation needed

  // ===== Omneon Video Networks (0e0b) =====
  // Acquired by Harmonic; legacy system
  // TODO: Archive documentation if available

  // ===== Ascent Media Group Inc. (0e0c) =====
  // No current known public documentation

  // ===== Quantel Ltd (0e0d) =====
  // Known: editing, effects, paint systems metadata
  // TODO: Technical documentation needed

  // ===== Panasonic (0e0e) =====
  // Known: P2, P2 HD, AVC-Ultra, AVC-Intra codecs
  // TODO: Extract from Panasonic P2 technical specs

  // ===== Grass Valley Inc. (0e0f) =====
  // Known: Ignite, Edius, video codec descriptors
  // TODO: Technical documentation needed

  // ===== Doremi Labs Inc. (0e10) =====
  // Known: DCP, IMF, cinema systems
  // TODO: Extract from DCP/IMF specifications

  // ===== EVS Broadcast Equipment (0e11) =====
  // Known: live event metadata, graphics, slow-motion
  // TODO: Technical documentation needed

  // ===== Turner Broadcasting System Inc. (0e12) =====
  // No current known public documentation

  // ===== NL Technology LLC (0e13) =====
  // No known public ULs documented

  // ===== Harris Corporation (0e14) =====
  // No current known public documentation

  // ===== Canon Inc. (0e15) =====
  // Known: EOS C300/C500/R5C cinema cameras
  // TODO: Extract from Canon technical specifications

  // ===== D-BOX Technologies (0e16) =====
  // Known: motion control, theatrical metadata
  // TODO: Technical documentation needed

  // ===== ARRI (0e17) =====
  // Known: Alexa cameras, Codex codecs, metadata
  // TODO: Extract from Alexa/Codex technical specs

  // ===== JVC (0e18) =====
  // Known: GY-HM cameras, professional video
  // TODO: Technical documentation needed

  // ===== 3ality Technica (0e19) =====
  // Known: stereoscopic 3D metadata
  // TODO: Technical documentation needed

  // ===== NHK (0e1a) =====
  // Known: 8K broadcasting, HEVC metadata
  // TODO: NHK technical documentation

  // ===== HBO (0e1b) =====
  // No known public ULs documented

  // ===== DTS Inc. (0e1d) =====
  // Known: audio codecs, spatial audio metadata
  // TODO: DTS technical specifications

  // ===== FLIR Systems Inc. (0e1e) =====
  // Known: thermal imaging, scientific metadata
  // TODO: FLIR technical documentation

  // ===== Barco (0e1f) =====
  // Known: display control, cinema systems
  // TODO: Barco technical specifications

  // ===== Apple Inc. (0e20) =====
  // Known: ProRes, ProRes RAW codecs
  // TODO: Extract from ProRes/ProRes RAW specifications

  // ===== Fraunhofer IIS (0e21) =====
  // Known: audio codecs (MP3, AAC), audio metadata
  // TODO: Fraunhofer technical specifications

  // ===== RED (0e22) =====
  // Known: R3D codec, camera metadata, color science
  // TODO: Extract from RED SDK and technical specs

  // ===== CRIFST (0e23) =====
  // No known public ULs documented

  // ===== FUJIFILM (0e24) =====
  // Known: X-Series cinema cameras
  // TODO: FUJIFILM technical documentation
};
