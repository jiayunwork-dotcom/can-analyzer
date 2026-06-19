fn main() {
    println!("cargo::rustc-check-cfg=cfg(mobile)");
    println!("cargo::rustc-check-cfg=cfg(desktop)");
    println!("cargo::rustc-cfg=desktop");

    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
    let permission_path = std::path::Path::new(&out_dir)
        .join("app-manifest")
        .join("__app__-permission-files");
    std::fs::create_dir_all(&permission_path).ok();

    println!("cargo:rustc-env=TAURI_ANDROID_PACKAGE_NAME_APP_NAME=app");
    println!("cargo:rustc-env=TAURI_ANDROID_PACKAGE_NAME_PREFIX=com_can_1analyzer");
    println!("cargo:PERMISSION_FILES_PATH={}", permission_path.display());
}
