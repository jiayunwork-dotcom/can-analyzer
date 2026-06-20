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
        // Bit numbering: bit N = byte (N/8) bit (N%8), bit 0 = LSB of byte
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
        // Bit numbering: bit N = byte (N/8) bit (N%8), bit 0 = LSB of byte, bit 7 = MSB of byte
        // Signal extraction order:
        //   k = 0 is MSB of signal, k = bit_len-1 is LSB
        //   In the start byte: go from start_bit_in_byte DOWN to 0 (MSB to LSB)
        //   In subsequent bytes: go from bit 7 DOWN to 0 (MSB to LSB of each byte)
        let start_byte = start_bit / 8;
        let start_bit_in_byte = start_bit % 8;

        for k in 0..bit_len {
            let byte_idx: usize;
            let bit_in_byte_pos: usize;

            if k <= start_bit_in_byte {
                // Still within the starting byte, going MSB -> LSB
                byte_idx = start_byte;
                bit_in_byte_pos = start_bit_in_byte - k;
            } else {
                // Crossed into subsequent bytes
                let remaining_k = k - (start_bit_in_byte + 1);
                let additional_byte = 1 + (remaining_k / 8);
                byte_idx = start_byte + additional_byte;
                bit_in_byte_pos = 7 - (remaining_k % 8);
            }

            if byte_idx < data.len() {
                let bit = (data[byte_idx] >> bit_in_byte_pos) & 1;
                // k=0 is MSB, shift left by (bit_len - 1 - k)
                raw |= (bit as u64) << (bit_len - 1 - k);
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
        // Motorola / big endian: same bit layout as extraction but writing
        let start_byte = start_bit / 8;
        let start_bit_in_byte = start_bit % 8;

        for k in 0..bit_len {
            let byte_idx: usize;
            let bit_in_byte_pos: usize;

            if k <= start_bit_in_byte {
                byte_idx = start_byte;
                bit_in_byte_pos = start_bit_in_byte - k;
            } else {
                let remaining_k = k - (start_bit_in_byte + 1);
                let additional_byte = 1 + (remaining_k / 8);
                byte_idx = start_byte + additional_byte;
                bit_in_byte_pos = 7 - (remaining_k % 8);
            }

            if byte_idx < data.len() {
                // k=0 is MSB, take bit from (bit_len - 1 - k) position in raw
                let bit = ((raw >> (bit_len - 1 - k)) & 1) as u8;
                data[byte_idx] = (data[byte_idx] & !(1u8 << bit_in_byte_pos)) | (bit << bit_in_byte_pos);
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
