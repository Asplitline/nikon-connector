use crate::{
    camera::{self, CameraPhoto},
    nikon_sdk,
};

pub fn set_photo_rating(photo_id: String, rating: u8) -> Result<CameraPhoto, String> {
    if rating > 5 {
        return Err("Rating must be between 0 and 5.".into());
    }

    let mut photo = camera::find_photo(&photo_id).ok_or_else(|| "Photo not found.".to_string())?;

    if nikon_sdk::rating_write_back_available() {
        nikon_sdk::set_rating(&photo_id, rating)?;
    }

    photo.rating = rating;
    Ok(photo)
}
