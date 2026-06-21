use crate::common::{row_i64, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::favorites;
use crate::Error;

use super::caveats::{favorite_world_local_caveats, worlds_visited_caveats};
use super::helpers::{append_time_window_filter, millis_to_minutes};
use super::types::{
    FavoriteWorldLocalInput, FavoriteWorldOutput, SearchWorldsVisitedInput,
    SearchWorldsVisitedOutput, VisitedWorldRow,
};

pub fn search_worlds_visited(
    db: &DatabaseService,
    input: SearchWorldsVisitedInput,
) -> Result<SearchWorldsVisitedOutput, Error> {
    let limit = input.limit.clamp(1, 100);
    let mut sql = String::from(
        "SELECT world_id, world_name, location, created_at, time
         FROM gamelog_location
         WHERE 1 = 1",
    );
    let mut params = ParamsBuilder::new().set("limit", limit);
    append_time_window_filter(&mut sql, &mut params, &input.time_window, "created_at");
    sql.push_str(" ORDER BY created_at DESC, id DESC LIMIT @limit");

    let rows = db
        .execute(&sql, &params.build())?
        .into_iter()
        .map(|row| VisitedWorldRow {
            world_id: row_string(&row, 0),
            world_name: row_string(&row, 1),
            location: row_string(&row, 2),
            visited_at: row_string(&row, 3),
            stay_minutes: millis_to_minutes(row_i64(&row, 4).max(0)),
        })
        .filter(|row| !row.world_id.is_empty() || !row.location.is_empty())
        .collect();

    Ok(SearchWorldsVisitedOutput {
        rows,
        caveats: worlds_visited_caveats(),
    })
}

pub fn favorite_world_local(
    db: &DatabaseService,
    input: FavoriteWorldLocalInput,
) -> Result<FavoriteWorldOutput, Error> {
    let world_id = input.world_id.trim().to_string();
    let group = input.group.trim().to_string();
    if world_id.is_empty() {
        return Err(Error::InvalidData(
            "favorite world requires world_id".into(),
        ));
    }
    if !world_id.starts_with("wrld_") {
        return Err(Error::InvalidData(
            "favorite world_id must be a VRChat world id (wrld_...)".into(),
        ));
    }
    if group.is_empty() {
        return Err(Error::InvalidData("favorite world requires group".into()));
    }
    let affected_rows = if input.dry_run {
        0
    } else {
        favorites::favorite_add(db, "world".into(), world_id.clone(), group.clone())?
    };
    Ok(FavoriteWorldOutput {
        world_id,
        group,
        dry_run: input.dry_run,
        affected_rows,
        caveats: favorite_world_local_caveats(),
    })
}
