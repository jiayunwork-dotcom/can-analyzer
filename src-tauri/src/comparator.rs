use crate::codec;
use crate::recording;
use crate::types::*;
use std::collections::{BTreeMap, HashMap, HashSet};

pub fn compare_recordings_batch(
    base_path: &str,
    compare_paths: &[String],
    dbc_data: &Option<DbcDatabase>,
    threshold_percent: f64,
) -> Result<BatchCompareResult, String> {
    let base_frames = recording::parse_asc_file(base_path)
        .map_err(|e| format!("Failed to parse base file: {}", e))?;

    let base_file_name = extract_file_name(base_path);
    let base_file_info = build_file_info(&base_file_name, &base_frames);

    let mut compare_results: Vec<CompareResult> = Vec::new();
    let mut failed_files: Vec<CompareFileError> = Vec::new();

    for compare_path in compare_paths {
        let compare_file_name = extract_file_name(compare_path);
        match recording::parse_asc_file(compare_path) {
            Ok(_) => {
                match compare_recordings(base_path, compare_path, dbc_data, threshold_percent) {
                    Ok(result) => compare_results.push(result),
                    Err(e) => failed_files.push(CompareFileError {
                        file_name: compare_file_name,
                        file_path: compare_path.clone(),
                        error_message: e,
                    }),
                }
            }
            Err(e) => failed_files.push(CompareFileError {
                file_name: compare_file_name,
                file_path: compare_path.clone(),
                error_message: format!("Failed to parse file: {}", e),
            }),
        }
    }

    let trends = compute_trends(&compare_results);

    Ok(BatchCompareResult {
        base_file: base_file_info,
        compare_results,
        failed_files,
        trends,
    })
}

fn compute_trends(compare_results: &[CompareResult]) -> Vec<SignalTrendInfo> {
    let mut trends: Vec<SignalTrendInfo> = Vec::new();

    if compare_results.len() < 3 {
        return trends;
    }

    let mut signal_avg_diffs: HashMap<(u32, String), (Vec<f64>, f64)> = HashMap::new();

    for (_, result) in compare_results.iter().enumerate() {
        for msg in &result.messages {
            for sig in &msg.signal_diffs {
                let key = (msg.message_id, sig.signal_name.clone());
                let entry = signal_avg_diffs
                    .entry(key)
                    .or_insert_with(|| (Vec::new(), sig.signal_range));
                entry.0.push(sig.avg_diff);
            }
        }
    }

    for ((message_id, signal_name), (avg_diffs, signal_range)) in signal_avg_diffs {
        let trend = if avg_diffs.len() < 3 {
            TrendResult {
                direction: TrendDirection::InsufficientData,
                slope: 0.0,
                r_squared: 0.0,
            }
        } else {
            linear_fit_trend(&avg_diffs, signal_range)
        };

        trends.push(SignalTrendInfo {
            message_id,
            signal_name,
            trend,
        });
    }

    trends
}

fn linear_fit_trend(data: &[f64], signal_range: f64) -> TrendResult {
    let n = data.len() as f64;

    let mut sum_x = 0.0;
    let mut sum_y = 0.0;
    let mut sum_xy = 0.0;
    let mut sum_x2 = 0.0;
    let mut sum_y2 = 0.0;

    for (i, &y) in data.iter().enumerate() {
        let x = i as f64;
        sum_x += x;
        sum_y += y;
        sum_xy += x * y;
        sum_x2 += x * x;
        sum_y2 += y * y;
    }

    let mean_x = sum_x / n;
    let mean_y = sum_y / n;

    let numerator = n * sum_xy - sum_x * sum_y;
    let denominator = n * sum_x2 - sum_x * sum_x;

    if denominator.abs() < f64::EPSILON {
        return TrendResult {
            direction: TrendDirection::Fluctuating,
            slope: 0.0,
            r_squared: 0.0,
        };
    }

    let slope = numerator / denominator;
    let intercept = mean_y - slope * mean_x;

    let mut ss_res = 0.0;
    let mut ss_tot = 0.0;

    for (i, &y) in data.iter().enumerate() {
        let x = i as f64;
        let predicted = slope * x + intercept;
        ss_res += (y - predicted).powi(2);
        ss_tot += (y - mean_y).powi(2);
    }

    let r_squared = if ss_tot.abs() < f64::EPSILON {
        1.0
    } else {
        1.0 - ss_res / ss_tot
    };

    let slope_threshold = signal_range.abs() * 0.01;

    let direction = if slope.abs() > slope_threshold && r_squared > 0.6 {
        if slope > 0.0 {
            TrendDirection::Worsening
        } else {
            TrendDirection::Improving
        }
    } else {
        TrendDirection::Fluctuating
    };

    TrendResult {
        direction,
        slope,
        r_squared,
    }
}

pub fn compare_recordings(
    base_path: &str,
    compare_path: &str,
    dbc_data: &Option<DbcDatabase>,
    threshold_percent: f64,
) -> Result<CompareResult, String> {
    let base_frames = recording::parse_asc_file(base_path)
        .map_err(|e| format!("Failed to parse base file: {}", e))?;
    let compare_frames = recording::parse_asc_file(compare_path)
        .map_err(|e| format!("Failed to parse compare file: {}", e))?;

    let base_file_name = extract_file_name(base_path);
    let compare_file_name = extract_file_name(compare_path);

    let base_file_info = build_file_info(&base_file_name, &base_frames);
    let compare_file_info = build_file_info(&compare_file_name, &compare_frames);

    let base_by_id = group_by_id(&base_frames);
    let compare_by_id = group_by_id(&compare_frames);

    let base_ids: HashSet<u32> = base_by_id.keys().copied().collect();
    let compare_ids: HashSet<u32> = compare_by_id.keys().copied().collect();
    let common_ids: HashSet<u32> = base_ids.intersection(&compare_ids).copied().collect();

    let only_in_base_ids: Vec<u32> = base_ids.difference(&compare_ids).copied().collect();
    let only_in_compare_ids: Vec<u32> = compare_ids.difference(&base_ids).copied().collect();

    let dbc_lookup: HashMap<u32, &DbcMessage> = match &dbc_data {
        Some(dbc) => dbc.messages.iter().map(|m| (m.id, m)).collect(),
        None => HashMap::new(),
    };

    let mut messages: Vec<MessageCompareResult> = Vec::new();

    for &id in &common_ids {
        let base_list = base_by_id.get(&id).unwrap();
        let compare_list = compare_by_id.get(&id).unwrap();

        let msg_result = compare_message(
            id,
            base_list,
            compare_list,
            &dbc_lookup,
            threshold_percent,
        );
        messages.push(msg_result);
    }

    for &id in &only_in_base_ids {
        let base_list = base_by_id.get(&id).unwrap();
        let msg_name = dbc_lookup
            .get(&id)
            .map(|m| m.name.clone())
            .unwrap_or_default();
        let is_extended = base_list.first().map(|f| f.is_extended).unwrap_or(false);
        messages.push(MessageCompareResult {
            message_id: id,
            message_name: msg_name,
            is_extended,
            base_frame_count: base_list.len() as u64,
            compare_frame_count: 0,
            matched_frame_count: 0,
            no_match_count: base_list.len() as u64,
            has_dbc: dbc_lookup.contains_key(&id),
            signal_diffs: Vec::new(),
            byte_diffs: Vec::new(),
            only_in_base: true,
            only_in_compare: false,
        });
    }

    for &id in &only_in_compare_ids {
        let compare_list = compare_by_id.get(&id).unwrap();
        let msg_name = dbc_lookup
            .get(&id)
            .map(|m| m.name.clone())
            .unwrap_or_default();
        let is_extended = compare_list.first().map(|f| f.is_extended).unwrap_or(false);
        messages.push(MessageCompareResult {
            message_id: id,
            message_name: msg_name,
            is_extended,
            base_frame_count: 0,
            compare_frame_count: compare_list.len() as u64,
            matched_frame_count: 0,
            no_match_count: 0,
            has_dbc: dbc_lookup.contains_key(&id),
            signal_diffs: Vec::new(),
            byte_diffs: Vec::new(),
            only_in_base: false,
            only_in_compare: true,
        });
    }

    messages.sort_by_key(|m| m.message_id);

    let frame_count_diff = compare_file_info.total_frames as i64 - base_file_info.total_frames as i64;
    let time_span_diff_us = compare_file_info.time_span_us as i64 - base_file_info.time_span_us as i64;

    Ok(CompareResult {
        base_file: base_file_info,
        compare_file: compare_file_info,
        frame_count_diff,
        time_span_diff_us,
        common_id_count: common_ids.len() as u32,
        only_in_base_ids,
        only_in_compare_ids,
        messages,
    })
}

fn extract_file_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn build_file_info(name: &str, frames: &[RecordedFrame]) -> CompareFileInfo {
    let total_frames = frames.len() as u64;
    let time_span_us = if frames.is_empty() {
        0
    } else {
        let min_ts = frames.first().unwrap().timestamp;
        let max_ts = frames.last().unwrap().timestamp;
        max_ts.saturating_sub(min_ts)
    };
    CompareFileInfo {
        file_name: name.to_string(),
        total_frames,
        time_span_us,
    }
}

fn group_by_id(frames: &[RecordedFrame]) -> BTreeMap<u32, Vec<&RecordedFrame>> {
    let mut map: BTreeMap<u32, Vec<&RecordedFrame>> = BTreeMap::new();
    for frame in frames {
        map.entry(frame.id).or_default().push(frame);
    }
    map
}

fn compare_message(
    id: u32,
    base_list: &[&RecordedFrame],
    compare_list: &[&RecordedFrame],
    dbc_lookup: &HashMap<u32, &DbcMessage>,
    threshold_percent: f64,
) -> MessageCompareResult {
    let msg_name = dbc_lookup
        .get(&id)
        .map(|m| m.name.clone())
        .unwrap_or_default();
    let is_extended = base_list
        .first()
        .map(|f| f.is_extended)
        .unwrap_or(false);

    let dbc_msg = dbc_lookup.get(&id);
    let cycle_time_us: Option<u64> = dbc_msg.and_then(|m| m.cycle_time_ms.map(|ct| ct * 1000));

    let pairs = align_frames(base_list, compare_list, cycle_time_us);

    let matched_count = pairs.iter().filter(|p| p.is_matched).count() as u64;
    let no_match_count = pairs.len() as u64 - matched_count;

    let has_dbc = dbc_msg.is_some();

    let (signal_diffs, byte_diffs) = if has_dbc {
        let msg = dbc_msg.unwrap();
        let sig_diffs = compute_signal_diffs(msg, &pairs, threshold_percent);
        let byte_diffs = compute_byte_diffs(&pairs);
        (sig_diffs, byte_diffs)
    } else {
        let byte_diffs = compute_byte_diffs(&pairs);
        (Vec::new(), byte_diffs)
    };

    MessageCompareResult {
        message_id: id,
        message_name: msg_name,
        is_extended,
        base_frame_count: base_list.len() as u64,
        compare_frame_count: compare_list.len() as u64,
        matched_frame_count: matched_count,
        no_match_count,
        has_dbc,
        signal_diffs,
        byte_diffs,
        only_in_base: false,
        only_in_compare: false,
    }
}

struct FramePair<'a> {
    base_frame: &'a RecordedFrame,
    compare_frame: Option<&'a RecordedFrame>,
    is_matched: bool,
}

fn align_frames<'a>(
    base_list: &[&'a RecordedFrame],
    compare_list: &[&'a RecordedFrame],
    cycle_time_us: Option<u64>,
) -> Vec<FramePair<'a>> {
    let max_gap_us = cycle_time_us.map(|ct| ct * 2);

    let mut pairs: Vec<FramePair<'a>> = Vec::with_capacity(base_list.len());

    if compare_list.is_empty() {
        for &bf in base_list {
            pairs.push(FramePair {
                base_frame: bf,
                compare_frame: None,
                is_matched: false,
            });
        }
        return pairs;
    }

    let mut compare_idx: usize = 0;

    for &bf in base_list {
        let base_ts = bf.timestamp;

        while compare_idx + 1 < compare_list.len()
            && compare_list[compare_idx + 1].timestamp < base_ts
        {
            compare_idx += 1;
        }

        let mut best_idx = compare_idx;
        let mut best_diff = if compare_list[compare_idx].timestamp >= base_ts {
            compare_list[compare_idx].timestamp - base_ts
        } else {
            base_ts - compare_list[compare_idx].timestamp
        };

        if compare_idx + 1 < compare_list.len() {
            let next_diff = if compare_list[compare_idx + 1].timestamp >= base_ts {
                compare_list[compare_idx + 1].timestamp - base_ts
            } else {
                base_ts - compare_list[compare_idx + 1].timestamp
            };
            if next_diff < best_diff {
                best_diff = next_diff;
                best_idx = compare_idx + 1;
            }
        }

        let is_matched = match max_gap_us {
            Some(max_gap) => best_diff <= max_gap,
            None => true,
        };

        pairs.push(FramePair {
            base_frame: bf,
            compare_frame: Some(compare_list[best_idx]),
            is_matched,
        });
    }

    pairs
}

fn compute_signal_diffs(
    msg: &DbcMessage,
    pairs: &[FramePair],
    threshold_percent: f64,
) -> Vec<SignalDiffSummary> {
    let mut result = Vec::new();

    for sig in &msg.signals {
        let signal_range = sig.max_value - sig.min_value;
        let threshold = signal_range * (threshold_percent / 100.0);

        let mut diffs: Vec<SignalDiffEntry> = Vec::new();
        let mut matched_count: u64 = 0;
        let mut no_match_count: u64 = 0;

        for pair in pairs {
            if !pair.is_matched || pair.compare_frame.is_none() {
                no_match_count += 1;
                continue;
            }

            let base_decoded = codec::decode_signals(msg, &pair.base_frame.data);
            let compare_decoded = codec::decode_signals(msg, &pair.compare_frame.unwrap().data);

            let base_sig = base_decoded.iter().find(|s| s.name == sig.name);
            let compare_sig = compare_decoded.iter().find(|s| s.name == sig.name);

            if let (Some(bs), Some(cs)) = (base_sig, compare_sig) {
                matched_count += 1;
                let diff = cs.physical_value - bs.physical_value;
                let diff_percent = if signal_range.abs() > f64::EPSILON {
                    (diff.abs() / signal_range) * 100.0
                } else {
                    0.0
                };

                diffs.push(SignalDiffEntry {
                    base_timestamp: pair.base_frame.timestamp,
                    base_value: bs.physical_value,
                    compare_value: cs.physical_value,
                    diff,
                    diff_percent,
                });
            }
        }

        let (max_diff, avg_diff, std_diff, over_threshold_ratio) = if diffs.is_empty() {
            (0.0, 0.0, 0.0, 0.0)
        } else {
            let diff_values: Vec<f64> = diffs.iter().map(|d| d.diff).collect();
            let abs_diffs: Vec<f64> = diff_values.iter().map(|d| d.abs()).collect();
            let max_diff = abs_diffs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let sum: f64 = diff_values.iter().sum();
            let avg_diff = sum / diff_values.len() as f64;
            let variance: f64 = diff_values
                .iter()
                .map(|d| (d - avg_diff).powi(2))
                .sum::<f64>()
                / diff_values.len() as f64;
            let std_diff = variance.sqrt();

            let over_count = abs_diffs.iter().filter(|&&d| d > threshold).count();
            let over_threshold_ratio = over_count as f64 / diffs.len() as f64;

            (max_diff, avg_diff, std_diff, over_threshold_ratio)
        };

        diffs.sort_by(|a, b| b.diff.abs().partial_cmp(&a.diff.abs()).unwrap_or(std::cmp::Ordering::Equal));

        result.push(SignalDiffSummary {
            signal_name: sig.name.clone(),
            unit: sig.unit.clone(),
            signal_range,
            max_diff,
            avg_diff,
            std_diff,
            over_threshold_ratio,
            matched_count,
            no_match_count,
            diff_entries: diffs,
        });
    }

    result
}

fn compute_byte_diffs(pairs: &[FramePair]) -> Vec<ByteDiffSummary> {
    let max_byte_len = pairs
        .iter()
        .filter(|p| p.is_matched && p.compare_frame.is_some())
        .map(|p| {
            let base_len = p.base_frame.data.len();
            let compare_len = p.compare_frame.unwrap().data.len();
            base_len.max(compare_len)
        })
        .max()
        .unwrap_or(0);

    let mut result = Vec::new();

    for byte_idx in 0..max_byte_len {
        let mut diff_count: u64 = 0;
        let mut total_matched: u64 = 0;

        for pair in pairs {
            if !pair.is_matched || pair.compare_frame.is_none() {
                continue;
            }
            let base_data = &pair.base_frame.data;
            let compare_data = &pair.compare_frame.unwrap().data;

            let base_val = base_data.get(byte_idx).copied();
            let compare_val = compare_data.get(byte_idx).copied();

            if base_val.is_some() || compare_val.is_some() {
                total_matched += 1;
                if base_val != compare_val {
                    diff_count += 1;
                }
            }
        }

        let diff_ratio = if total_matched > 0 {
            diff_count as f64 / total_matched as f64
        } else {
            0.0
        };

        if diff_count > 0 {
            result.push(ByteDiffSummary {
                byte_index: byte_idx as u8,
                diff_count,
                total_matched,
                diff_ratio,
            });
        }
    }

    result
}
