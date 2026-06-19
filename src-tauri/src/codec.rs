use crate::types::{DbcMessage, DbcSignal, DecodedSignal};

pub fn decode_signals(msg: &DbcMessage, data: &[u8]) -> Vec<DecodedSignal> {
    msg.signals
        .iter()
        .map(|sig| {
            let raw = extract_raw_value(data, sig);
            let physical = (raw as f64) * sig.factor + sig.offset;
            let enum_label = if !sig.value_table.is_empty() {
                sig.value_table.get(&(raw as u64)).cloned()
            } else {
                None
            };
            DecodedSignal {
                name: sig.name.clone(),
                raw_value: raw,
                physical_value: physical,
                unit: sig.unit.clone(),
                enum_label,
            }
        })
        .collect()
}

pub fn encode_signal_values(
    msg: &DbcMessage,
    signal_values: &std::collections::HashMap<String, f64>,
    base_data: &[u8],
) -> Vec<u8> {
    let mut data = if base_data.len() >= 8 {
        base_data.to_vec()
    } else {
        let mut d = base_data.to_vec();
        d.resize(8, 0);
        d
    };

    for sig in &msg.signals {
        if let Some(&phys_value) = signal_values.get(&sig.name) {
            let raw = ((phys_value - sig.offset) / sig.factor).round() as i64;
            insert_raw_value(&mut data, sig, raw);
        }
    }

    data.truncate(msg.dlc as usize);
    data
}

fn extract_raw_value(data: &[u8], sig: &DbcSignal) -> i64 {
    let start_bit = sig.start_bit as usize;
    let bit_len = sig.bit_length as usize;

    let mut raw: u64 = 0;

    if sig.is_little_endian {
        // Intel / little endian: start_bit = LSB position
        // Bit 0 = LSB of byte 0
        // Signal extends from start_bit (LSB) to higher bit numbers (MSB)
        for i in 0..bit_len {
            let bit_pos = start_bit + i;
            let byte_idx = bit_pos / 8;
            let bit_in_byte = bit_pos % 8;
            if byte_idx < data.len() {
                let bit = (data[byte_idx] >> bit_in_byte) & 1;
                raw |= (bit as u64) << i;
            }
        }
    } else {
        // Motorola / big endian: start_bit = MSB position
        // DBC bit numbering: bit 0 = MSB of byte 0, bit 7 = LSB of byte 0
        // Signal extends from start_bit (MSB) to higher bit numbers (towards LSB)
        for i in 0..bit_len {
            // i = 0 is LSB of signal, i = bit_len - 1 is MSB
            let dbc_bit = start_bit + (bit_len - 1 - i);
            let byte_idx = dbc_bit / 8;
            let bit_in_byte = 7 - (dbc_bit % 8); // DBC bit 0 = MSB = data bit 7
            if byte_idx < data.len() {
                let bit = (data[byte_idx] >> bit_in_byte) & 1;
                raw |= (bit as u64) << i;
            }
        }
    }

    if sig.is_signed {
        sign_extend(raw, bit_len as u32) as i64
    } else {
        raw as i64
    }
}

fn insert_raw_value(data: &mut [u8], sig: &DbcSignal, value: i64) {
    let start_bit = sig.start_bit as usize;
    let bit_len = sig.bit_length as usize;
    let mask: u64 = if bit_len >= 64 { u64::MAX } else { (1u64 << bit_len) - 1 };
    let raw = (value as u64) & mask;

    if sig.is_little_endian {
        // Intel / little endian
        for i in 0..bit_len {
            let bit_pos = start_bit + i;
            let byte_idx = bit_pos / 8;
            let bit_in_byte = bit_pos % 8;
            if byte_idx < data.len() {
                let bit = ((raw >> i) & 1) as u8;
                data[byte_idx] = (data[byte_idx] & !(1u8 << bit_in_byte)) | (bit << bit_in_byte);
            }
        }
    } else {
        // Motorola / big endian
        for i in 0..bit_len {
            // i = 0 is LSB of signal, i = bit_len - 1 is MSB
            let dbc_bit = start_bit + (bit_len - 1 - i);
            let byte_idx = dbc_bit / 8;
            let bit_in_byte = 7 - (dbc_bit % 8); // DBC bit 0 = MSB = data bit 7
            if byte_idx < data.len() {
                let bit = ((raw >> i) & 1) as u8;
                data[byte_idx] = (data[byte_idx] & !(1u8 << bit_in_byte)) | (bit << bit_in_byte);
            }
        }
    }
}

fn sign_extend(value: u64, bits: u32) -> i64 {
    if bits == 0 || bits >= 64 {
        return value as i64;
    }
    let sign_bit = 1u64 << (bits - 1);
    if (value & sign_bit) != 0 {
        let mask = !((1u64 << bits) - 1);
        (value | mask) as i64
    } else {
        value as i64
    }
}
