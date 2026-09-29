fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        let profiles = std::path::Path::new("../native/brouter/resources/profiles2")
            .canonicalize()
            .expect("Run engine:build first");
        println!("cargo:rerun-if-changed={}", profiles.display());
        let mut output = String::from("const BUNDLED_PROFILES: &[(&str, &[u8])] = &[\n");
        for entry in std::fs::read_dir(profiles).unwrap() {
            let path = entry.unwrap().path();
            if path.is_file() {
                output.push_str(&format!(
                    "({:?}, include_bytes!({:?})),\n",
                    path.file_name().unwrap().to_str().unwrap(),
                    path.to_str().unwrap()
                ));
            }
        }
        output.push_str("];\n");
        std::fs::write(
            std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("profiles.rs"),
            output,
        )
        .unwrap();
    }
    tauri_build::build()
}
