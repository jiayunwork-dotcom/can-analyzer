use crate::types::{DbcDatabase, DbcMessage, DbcSignal};
use std::collections::HashMap;

pub fn parse_dbc(content: &str) -> DbcDatabase {
    let mut version = String::new();
    let mut messages: Vec<DbcMessage> = Vec::new();
    let mut message_signals: HashMap<u32, Vec<DbcSignal>> = HashMap::new();
    let mut value_tables: HashMap<String, HashMap<u64, String>> = HashMap::new();

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        if line.starts_with("VERSION") {
            if let Some(idx) = line.find('"') {
                if let Some(end_idx) = line[idx + 1..].find('"') {
                    version = line[idx + 1..idx + 1 + end_idx].to_string();
                }
            }
        } else if line.starts_with("BO_ ") {
            let (msg, msg_id) = parse_message(line);
            messages.push(msg);
            let mut signals = Vec::new();
            i += 1;
            while i < lines.len() {
                let next_line = lines[i].trim();
                if next_line.is_empty() {
                    break;
                }
                if next_line.starts_with("SG_ ") {
                    signals.push(parse_signal(next_line));
                } else if !next_line.starts_with("SG_") {
                    break;
                }
                i += 1;
            }
            message_signals.insert(msg_id, signals);
            continue;
        } else if line.starts_with("VAL_ ") {
            if let Some((sig_key, table)) = parse_value_table(line) {
                value_tables.insert(sig_key, table);
            }
        }

        i += 1;
    }

    for msg in &mut messages {
        if let Some(signals) = message_signals.get(&msg.id) {
            let mut processed_signals = signals.clone();
            for sig in &mut processed_signals {
                let key = format!("{}_{}", msg.name, sig.name);
                if let Some(table) = value_tables.get(&key) {
                    sig.value_table = table.clone();
                }
                if sig.is_multiplexor {
                    msg.has_multiplexor = true;
                    msg.multiplexor_signal_name = Some(sig.name.clone());
                }
            }
            msg.signals = processed_signals;
        }
    }

    DbcDatabase { messages, version }
}

fn parse_message(line: &str) -> (DbcMessage, u32) {
    let parts: Vec<&str> = line.split_whitespace().collect();
    let id_str = parts[1].trim_end_matches(':');
    let id = id_str.parse::<u32>().unwrap_or(0);
    let is_extended = id > 0x7FF;
    let name = parts[2].trim_end_matches(':').to_string();
    let dlc: u8 = parts.get(3).and_then(|s| s.parse().ok()).unwrap_or(8);
    let sender = parts.get(4).unwrap_or(&"").to_string();

    (
        DbcMessage {
            id,
            is_extended,
            name,
            dlc,
            sender,
            signals: Vec::new(),
            has_multiplexor: false,
            multiplexor_signal_name: None,
        },
        id,
    )
}

fn parse_signal(line: &str) -> DbcSignal {
    let mut name = String::new();
    let mut start_bit: u8 = 0;
    let mut bit_length: u8 = 0;
    let mut is_little_endian = true;
    let mut is_signed = false;
    let mut factor: f64 = 1.0;
    let mut offset: f64 = 0.0;
    let mut min_value: f64 = 0.0;
    let mut max_value: f64 = 0.0;
    let mut unit = String::new();
    let mut is_multiplexor = false;
    let mut multiplexor_value: Option<u64> = None;

    let line = line.trim_start_matches("SG_").trim();

    let rest: &str;

    if let Some(colon_pos) = line.find(':') {
        let before_colon = &line[..colon_pos];
        let after_colon = &line[colon_pos + 1..];

        let before_parts: Vec<&str> = before_colon.split_whitespace().collect();
        if before_parts.len() >= 1 {
            name = before_parts[0].to_string();
        }
        if before_parts.len() >= 2 {
            let mp = before_parts[1];
            if mp == "M" {
                is_multiplexor = true;
            } else if let Some(stripped) = mp.strip_prefix('m') {
                if let Ok(val) = stripped.parse::<u64>() {
                    multiplexor_value = Some(val);
                }
            }
        }

        rest = after_colon;
    } else {
        rest = line;
    }

    if let Some(bracket_start) = rest.find('|') {
        let bit_info = &rest[..bracket_start];
        let bits: Vec<&str> = bit_info.split_whitespace().collect();
        if bits.len() >= 2 {
            if let Some(at_pos) = bits[1].find('@') {
                start_bit = bits[1][..at_pos].parse().unwrap_or(0);
                let after_at = &bits[1][at_pos + 1..];
                if after_at.len() >= 2 {
                    is_little_endian = &after_at[0..1] == "1";
                    is_signed = &after_at[1..2] == "-";
                }
            }
            bit_length = bits[0].parse().unwrap_or(0);
        }

        let after_bracket = &rest[bracket_start + 1..];
        if let Some(comma_pos) = after_bracket.find(',') {
            if let Ok(f) = after_bracket[..comma_pos].parse::<f64>() {
                factor = f;
            }
            let after_comma = &after_bracket[comma_pos + 1..];
            if let Some(bracket_end) = after_comma.find(']') {
                if let Ok(o) = after_comma[..bracket_end].parse::<f64>() {
                    offset = o;
                }
                let after_offset = &after_comma[bracket_end + 1..];

                if let Some(range_start) = after_offset.find('[') {
                    if let Some(range_end) = after_offset.find(']') {
                        let range_str = &after_offset[range_start + 1..range_end];
                        let range_parts: Vec<&str> = range_str.split('|').collect();
                        if range_parts.len() >= 2 {
                            min_value = range_parts[0].parse().unwrap_or(0.0);
                            max_value = range_parts[1].parse().unwrap_or(0.0);
                        }
                        let after_range = &after_offset[range_end + 1..];
                        if let Some(quote_start) = after_range.find('"') {
                            let after_quote = &after_range[quote_start + 1..];
                            if let Some(quote_end) = after_quote.find('"') {
                                unit = after_quote[..quote_end].to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    DbcSignal {
        name,
        start_bit,
        bit_length,
        is_little_endian,
        is_signed,
        factor,
        offset,
        min_value,
        max_value,
        unit,
        value_table: HashMap::new(),
        is_multiplexor,
        multiplexor_value,
    }
}

fn parse_value_table(line: &str) -> Option<(String, HashMap<u64, String>)> {
    let parts: Vec<&str> = line.splitn(4, char::is_whitespace).collect();
    if parts.len() < 4 {
        return None;
    }

    let msg_id_str = parts[1];
    let sig_name = parts[2];
    let values_str = parts[3];

    let msg_id = msg_id_str.parse::<u32>().ok()?;

    let mut table = HashMap::new();
    let mut remaining = values_str.trim();

    while !remaining.is_empty() {
        remaining = remaining.trim_start();
        if remaining.is_empty() || remaining.starts_with(';') {
            break;
        }

        let num_end = remaining
            .find(|c: char| !c.is_ascii_digit() && c != '-')
            .unwrap_or(remaining.len());
        let num_str = &remaining[..num_end];
        let num: u64 = num_str.parse().ok()?;
        remaining = &remaining[num_end..];

        remaining = remaining.trim_start();
        if remaining.starts_with('"') {
            remaining = &remaining[1..];
            if let Some(end_idx) = remaining.find('"') {
                let val = remaining[..end_idx].to_string();
                table.insert(num, val);
                remaining = &remaining[end_idx + 1..];
            } else {
                break;
            }
        } else {
            break;
        }
    }

    let fake_msg_name = format!("msg_{}", msg_id);
    Some((format!("{}_{}", fake_msg_name, sig_name), table))
}
