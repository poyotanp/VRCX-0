use std::path::PathBuf;
use std::sync::Arc;

use vrcx_0_media::image_cache::ImageCache as LocalImageCache;
use vrcx_0_media::ugc_image_files::UgcCategory;
use vrcx_0_media::Error as MediaError;
use vrcx_0_vrchat_client::image_fetcher::ImageFetcher;

use crate::Result;

pub struct ImageCache {
    fetcher: Arc<ImageFetcher>,
    local_cache: LocalImageCache,
}

impl ImageCache {
    pub fn new(cache_dir: PathBuf, fetcher: Arc<ImageFetcher>) -> Result<Self> {
        Ok(Self {
            fetcher,
            local_cache: LocalImageCache::new(cache_dir)?,
        })
    }

    pub async fn get_image(&self, url: &str, file_id: &str, version: &str) -> Result<String> {
        Ok(self
            .local_cache
            .get_image_with_fetch(file_id, version, || async {
                self.fetch_image(url)
                    .await
                    .map_err(|error| MediaError::Custom(error.to_string()))
            })
            .await?)
    }

    pub async fn save_image_to_file(&self, url: &str, path: &str) -> Result<()> {
        Ok(self
            .local_cache
            .save_image_to_file_with_fetch(path, || async {
                self.fetch_image(url)
                    .await
                    .map_err(|error| MediaError::Custom(error.to_string()))
            })
            .await?)
    }

    async fn fetch_image(&self, url: &str) -> Result<Vec<u8>> {
        Ok(self.fetcher.fetch_image(url).await?)
    }
}

pub async fn save_ugc_image_to_file(
    image_cache: &ImageCache,
    url: &str,
    ugc_folder_path: &str,
    category: UgcCategory,
    month_folder: &str,
    file_name: &str,
) -> Result<String> {
    let out = vrcx_0_media::ugc_image_files::build_ugc_image_path(
        ugc_folder_path,
        category,
        month_folder,
        file_name,
    )?;
    let out_str = out.to_string_lossy().into_owned();
    image_cache.save_image_to_file(url, &out_str).await?;
    Ok(out_str)
}
