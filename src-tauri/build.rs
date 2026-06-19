fn main() {
    // Skip Windows resource compilation when windres is not available
    std::env::set_var("TAURI_SKIP_WINRES", "true");
    tauri_build::build();
}
