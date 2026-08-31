pub fn rating_write_back_available() -> bool {
    false
}

pub fn set_rating(_photo_id: &str, _rating: u8) -> Result<(), String> {
    Err("Nikon SDK rating write-back is not connected yet.".into())
}
