use cosmic_text::FontSystem;

/// Sans-serif families, in preference order, that carry both Latin and CJK
/// glyphs. The text measurer and the renderer must agree on this selection so
/// that the widths computed during layout match the glyphs actually drawn.
const PREFERRED_SANS_FAMILIES: &[&str] = &[
    "Microsoft YaHei UI",
    "Microsoft YaHei",
    "Microsoft JhengHei UI",
    "Microsoft JhengHei",
    "Yu Gothic UI",
    "Noto Sans CJK SC",
    "Noto Sans CJK JP",
    "Noto Sans CJK TC",
    "Source Han Sans SC",
    "Source Han Sans JP",
    "Source Han Sans TC",
    "WenQuanYi Micro Hei",
];

/// Pick the first installed preferred sans-serif family, if any.
pub(crate) fn preferred_sans_family(font_system: &FontSystem) -> Option<String> {
    PREFERRED_SANS_FAMILIES
        .iter()
        .find(|family| {
            font_system.db().faces().any(|face| {
                face.families
                    .iter()
                    .any(|(name, _)| name.eq_ignore_ascii_case(family))
            })
        })
        .map(|family| (*family).to_string())
}

/// Configure a freshly created [`FontSystem`] with the preferred sans-serif
/// family so Latin and CJK text share a single, consistent metric source.
pub(crate) fn configure_font_system(font_system: &mut FontSystem) {
    if let Some(family) = preferred_sans_family(font_system) {
        font_system.db_mut().set_sans_serif_family(family);
    }
}
