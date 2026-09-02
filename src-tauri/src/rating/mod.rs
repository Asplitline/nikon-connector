use crate::{
    camera::{self, CameraPhoto},
    nikon_sdk,
};

pub fn set_photo_rating(photo_id: String, rating: u8) -> Result<CameraPhoto, String> {
    if rating > 5 {
        return Err("Rating must be between 0 and 5.".into());
    }

    let photo = camera::find_photo(&photo_id).ok_or_else(|| "Photo not found.".to_string())?;

    if !nikon_sdk::rating_write_back_available() {
        return Err("Nikon SDK rating write-back is not connected yet.".into());
    }

    nikon_sdk::set_rating(&photo_id, rating)?;

    let mut photo = photo;
    photo.rating = rating;
    Ok(photo)
}
