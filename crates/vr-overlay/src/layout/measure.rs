use std::cell::RefCell;
use std::collections::HashMap;

use cosmic_text::{Attrs, Buffer, FontSystem, Metrics, Shaping};

use crate::font::configure_font_system;

// Per-glyph advance is linear in font size, so each glyph is measured once at a
// large reference size and the resulting "width per em" is cached and scaled.
const REFERENCE_SIZE: f32 = 64.0;

thread_local! {
    static MEASURER: RefCell<TextMeasurer> = RefCell::new(TextMeasurer::new());
}

struct TextMeasurer {
    font_system: FontSystem,
    char_em: HashMap<char, f32>,
}

impl TextMeasurer {
    fn new() -> Self {
        let mut font_system = FontSystem::new();
        configure_font_system(&mut font_system);
        Self {
            font_system,
            char_em: HashMap::new(),
        }
    }

    fn char_em(&mut self, ch: char) -> f32 {
        if let Some(em) = self.char_em.get(&ch) {
            return *em;
        }
        let mut text = [0u8; 4];
        let width = self.shape_width(ch.encode_utf8(&mut text), REFERENCE_SIZE);
        let em = (width / REFERENCE_SIZE).max(0.0);
        self.char_em.insert(ch, em);
        em
    }

    fn shape_width(&mut self, text: &str, font_size: f32) -> f32 {
        let metrics = Metrics::new(font_size, font_size);
        let mut buffer = Buffer::new(&mut self.font_system, metrics);
        // Effectively unbounded line width so a single glyph is never wrapped.
        buffer.set_size(Some(1.0e6), Some(font_size));
        buffer.set_text(text, &Attrs::new(), Shaping::Advanced, None);
        buffer.shape_until_scroll(&mut self.font_system, false);
        buffer
            .layout_runs()
            .map(|run| run.line_w)
            .fold(0.0_f32, f32::max)
    }
}

/// Rendered width of a single character at `font_size`, matching the glyphs the
/// [`crate::TinySkiaRenderer`] draws. Cached per character.
pub fn char_width(ch: char, font_size: f32) -> f32 {
    MEASURER.with(|measurer| measurer.borrow_mut().char_em(ch) * font_size)
}

/// Rendered width of `text` at `font_size`. Per-character advances are additive
/// for the UI font in use, so this sums cached glyph widths and avoids reshaping
/// whole strings every frame.
pub fn text_width(text: &str, font_size: f32) -> f32 {
    text.chars().map(|ch| char_width(ch, font_size)).sum()
}
