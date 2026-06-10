use super::measure::char_width;

const ELLIPSIS: char = '…';

pub fn ellipsize_to_width(text: &str, max_width: f32, font_size: f32) -> String {
    let max_width = max_width.max(1.0);
    let mut output = String::new();
    let mut widths = Vec::new();
    let mut width = 0.0;
    let mut truncated = false;

    for ch in text.chars() {
        let glyph_width = char_width(ch, font_size);
        if width + glyph_width > max_width {
            truncated = true;
            break;
        }
        output.push(ch);
        widths.push(glyph_width);
        width += glyph_width;
    }

    if !truncated {
        return text.to_string();
    }

    let ellipsis_width = char_width(ELLIPSIS, font_size);
    while !widths.is_empty() && width + ellipsis_width > max_width {
        width -= widths.pop().unwrap_or_default();
        output.pop();
    }
    if output.is_empty() {
        return ELLIPSIS.to_string();
    }
    output.push(ELLIPSIS);
    output
}
