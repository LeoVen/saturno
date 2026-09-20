use wasm_bindgen::prelude::*;

/// Toolchain spike (E01-T2): proves the Rust -> WASM -> JS/Worker path works
/// end-to-end before any real solver logic is written. Safe to delete once
/// E06 introduces the real `verify`/`generate` exports (IMPL.md §4).
#[wasm_bindgen]
pub fn ping() -> String {
    format!("pong from solver v{}", env!("CARGO_PKG_VERSION"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_reports_the_crate_version() {
        assert_eq!(
            ping(),
            format!("pong from solver v{}", env!("CARGO_PKG_VERSION"))
        );
    }
}
