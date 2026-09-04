use super::types::{CameraDevice, CameraPhoto};

#[cfg_attr(target_os = "macos", allow(dead_code))]
pub fn list_cameras() -> Vec<CameraDevice> {
    vec![CameraDevice {
        id: "z6iii".into(),
        name: "Nikon Z6III".into(),
        model: "Z6III".into(),
        connection: "mock".into(),
    }]
}

pub fn list_photos(camera_id: &str) -> Vec<CameraPhoto> {
    // NIKON_MOCK_PHOTO_COUNT 用于在没有真机的环境验证虚拟化与流式投递：
    // 生成一份大目录，其余行为与手写 mock 一致。缺省仍是那 5 张。
    if let Some(count) = synthetic_photo_count() {
        return synthetic_photos(camera_id, count);
    }

    mock_photos()
        .into_iter()
        .filter(|photo| photo.camera_id == camera_id)
        .collect()
}

fn synthetic_photo_count() -> Option<usize> {
    let raw = std::env::var("NIKON_MOCK_PHOTO_COUNT").ok()?;
    let count = raw.trim().parse::<usize>().ok()?;
    (count > 0).then_some(count)
}

// 合成目录：文件名/时间/评级/体积都按序变化，便于验证筛选与排序
fn synthetic_photos(camera_id: &str, count: usize) -> Vec<CameraPhoto> {
    let templates = mock_photos();

    (0..count)
        .map(|index| {
            let template = &templates[index % templates.len()];
            let sequence = 1000 + index;
            let is_raw = index % 3 == 0;
            let extension = if is_raw { "NEF" } else { "JPG" };

            CameraPhoto {
                id: format!("{camera_id}:mock-{sequence}"),
                camera_id: camera_id.to_string(),
                file_name: format!("DSC_{sequence}.{extension}"),
                // 每张间隔 12 秒，模拟连拍序列
                captured_at: synthetic_timestamp(index),
                rating: (index % 6) as u8,
                file_type: extension.to_lowercase(),
                width: 6048,
                height: 4024,
                size_mb: if is_raw { 41.2 } else { 18.6 },
                // 预览留空，交由 cache_photo_previews 按需填充，
                // 这样才能真实验证渐进式投递
                preview_url: String::new(),
                thumbnail_url: String::new(),
                object_handle: Some(sequence.to_string()),
                storage_id: Some("mock-store".into()),
                can_download_original: Some(true),
                has_embedded_preview: template.has_embedded_preview,
            }
        })
        .collect()
}

// 每张间隔 12 秒，从 07:00 起算；超过当天就滚到次日，
// 保证任意 count 下时间戳都是合法 ISO 8601
fn synthetic_timestamp(index: usize) -> String {
    const START_HOUR: usize = 7;
    const SECONDS_PER_DAY: usize = 24 * 3600;

    let offset = START_HOUR * 3600 + index * 12;
    let day_index = offset / SECONDS_PER_DAY;
    let within_day = offset % SECONDS_PER_DAY;

    // 2026-08-31 起，按 31 天月份粗略推进日期即可（仅用于 mock 排序）
    let day = 31 + day_index;
    let (month, day) = if day > 31 {
        (9, day - 31)
    } else {
        (8, day)
    };

    let hour = within_day / 3600;
    let minute = (within_day % 3600) / 60;
    let second = within_day % 60;
    format!("2026-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.000Z")
}

pub fn mock_photos() -> Vec<CameraPhoto> {
    vec![
        CameraPhoto {
            id: "dsc-6312".into(),
            camera_id: "z6iii".into(),
            file_name: "DSC_6312.JPG".into(),
            captured_at: "2026-08-31T07:24:00.000Z".into(),
            rating: 4,
            file_type: "jpg".into(),
            width: 6048,
            height: 4024,
            size_mb: 19.8,
            preview_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82".into(),
            thumbnail_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=420&q=80".into(),
            object_handle: None,
            storage_id: None,
            can_download_original: Some(true),
            has_embedded_preview: Some(true),
        },
        CameraPhoto {
            id: "dsc-6328".into(),
            camera_id: "z6iii".into(),
            file_name: "DSC_6328.NEF".into(),
            captured_at: "2026-08-31T07:39:00.000Z".into(),
            rating: 0,
            file_type: "nef".into(),
            width: 6048,
            height: 4024,
            size_mb: 37.2,
            preview_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=82".into(),
            thumbnail_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=420&q=80".into(),
            object_handle: None,
            storage_id: None,
            can_download_original: Some(true),
            has_embedded_preview: Some(true),
        },
        CameraPhoto {
            id: "dsc-6341".into(),
            camera_id: "z6iii".into(),
            file_name: "DSC_6341.JPG".into(),
            captured_at: "2026-08-31T08:02:00.000Z".into(),
            rating: 2,
            file_type: "jpg".into(),
            width: 6048,
            height: 4024,
            size_mb: 16.5,
            preview_url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1600&q=82".into(),
            thumbnail_url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=420&q=80".into(),
            object_handle: None,
            storage_id: None,
            can_download_original: Some(true),
            has_embedded_preview: Some(true),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::{synthetic_photos, synthetic_timestamp};

    #[test]
    fn synthetic_catalog_has_unique_ids_and_requires_preview_fetch() {
        let photos = synthetic_photos("z6iii", 2477);

        assert_eq!(photos.len(), 2477);

        let unique: std::collections::HashSet<_> = photos.iter().map(|p| &p.id).collect();
        assert_eq!(unique.len(), photos.len());

        // 预览必须留空，否则流式投递无从验证
        assert!(photos
            .iter()
            .all(|p| p.preview_url.is_empty() && p.thumbnail_url.is_empty()));
        assert!(photos.iter().all(|p| p.camera_id == "z6iii"));
    }

    #[test]
    fn synthetic_catalog_mixes_raw_and_jpeg() {
        let photos = synthetic_photos("z6iii", 30);

        assert!(photos.iter().any(|p| p.file_type == "nef"));
        assert!(photos.iter().any(|p| p.file_type == "jpg"));
    }

    #[test]
    fn synthetic_catalog_covers_every_rating_bucket() {
        let photos = synthetic_photos("z6iii", 60);

        for rating in 0..=5u8 {
            assert!(
                photos.iter().any(|p| p.rating == rating),
                "rating {rating} missing"
            );
        }
    }

    #[test]
    fn synthetic_timestamps_stay_valid_past_a_full_day() {
        // 7200 张 × 12s 会跨过当天，时间戳必须仍然合法
        for index in [0usize, 1, 2477, 7200, 10_000] {
            let stamp = synthetic_timestamp(index);
            let hour: u32 = stamp[11..13].parse().expect("hour parses");
            let minute: u32 = stamp[14..16].parse().expect("minute parses");
            let second: u32 = stamp[17..19].parse().expect("second parses");

            assert!(hour < 24, "index {index} produced hour {hour}");
            assert!(minute < 60);
            assert!(second < 60);
        }
    }

    #[test]
    fn synthetic_timestamps_increase_monotonically() {
        let photos = synthetic_photos("z6iii", 500);
        let mut previous = photos[0].captured_at.clone();

        for photo in photos.iter().skip(1) {
            assert!(
                photo.captured_at > previous,
                "{} should sort after {previous}",
                photo.captured_at
            );
            previous = photo.captured_at.clone();
        }
    }
}
