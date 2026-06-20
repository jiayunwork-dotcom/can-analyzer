fn main() {
    std::env::set_var("TAURI_SKIP_WINRES", "true");
    tauri_build::build();
}
