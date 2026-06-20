use crate::types::{CanFrame, RecordedFrame};
use std::fs::File;
use std::io::{BufRead, BufReader, Write};

pub fn start_recording(path: &str) -> std::io::Result<File> {
    let mut file = File::create(path)?;
    writeln!(file, "date {}", chrono_like_now())?;
    writeln!(file, "base hex  timestamps absolute")?;
    writeln!(file, "no internal events logged")?;
    writeln!(file, "// version 13.0.0")?;
    Ok(file)
}

pub fn write_frame(file: &mut File, frame: &CanFrame, timestamp_us: u64, _channel: u8) -> std::io::Result<()> {
    let timestamp_sec = (timestamp_us as f64) / 1_000_000.0;
    let dir = if frame.is_tx { "Tx" } else { "Rx" };
    let id_hex = if frame.is_extended {
        format!("{:08X}x", frame.id)
    } else {
        format!("{:03X}", frame.id)
    };
    let data_str: Vec<String> = frame.data.iter().map(|b| format!("{:02X}", b)).collect();

    writeln!(
        file,
        "{:.6} 1 {} {}  d {} {}",
        timestamp_sec,
        id_hex,
        dir,
        frame.dlc,
        data_str.join(" ")
    )
}

pub fn parse_asc_file(path: &str) -> std::io::Result<Vec<RecordedFrame>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut frames = Vec::new();
    let mut base_timestamp: Option<u64> = None;

    for line in reader.lines() {
        let line = line?;
        let trimmed = line.trim();

        if trimmed.is_empty()
            || trimmed.starts_with("//")
            || trimmed.starts_with("date")
            || trimmed.starts_with("base")
            || trimmed.starts_with("no internal")
            || trimmed.starts_with("Begin")
            || trimmed.starts_with("End")
        {
            continue;
        }

        if let Some(frame) = parse_asc_line(trimmed, &mut base_timestamp) {
            frames.push(frame);
        }
    }

    Ok(frames)
}

fn parse_asc_line(line: &str, base_timestamp: &mut Option<u64>) -> Option<RecordedFrame> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 6 {
        return None;
    }

    let ts_str = parts[0];
    let ts_float: f64 = ts_str.parse().ok()?;

    let timestamp = if let Some(base) = base_timestamp {
        ((ts_float * 1_000_000.0) as u64).saturating_sub(*base)
    } else {
        *base_timestamp = Some((ts_float * 1_000_000.0) as u64);
        0
    };

    let channel: u8 = parts[1].parse().ok().unwrap_or(1);

    let id_str = parts[2];
    let (id, is_extended) = if id_str.ends_with('x') || id_str.ends_with('X') {
        let trimmed = id_str.trim_end_matches(|c: char| c == 'x' || c == 'X');
        (u32::from_str_radix(trimmed, 16).ok()?, true)
    } else {
        (u32::from_str_radix(id_str, 16).ok()?, false)
    };

    let dir_str = parts[3];
    let is_tx = dir_str.eq_ignore_ascii_case("Tx") || dir_str.eq_ignore_ascii_case("T");

    let dlc_idx = if parts[4] == "d" { 5 } else { 4 };
    let dlc: u8 = parts.get(dlc_idx)?.parse().ok().unwrap_or(8);

    let mut data = Vec::new();
    for i in (dlc_idx + 1)..(dlc_idx + 1 + dlc as usize).min(parts.len()) {
        if let Ok(byte) = u8::from_str_radix(parts[i], 16) {
            data.push(byte);
        }
    }

    Some(RecordedFrame {
        timestamp,
        channel,
        id,
        is_extended,
        is_tx,
        dlc,
        data,
    })
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let secs_in_day = secs % 86400;
    let hours = secs_in_day / 3600;
    let mins = (secs_in_day % 3600) / 60;
    let secs = secs_in_day % 60;
    format!(
        "Day {} {}:{}:{}",
        days,
        hours,
        mins,
        secs
    )
}
