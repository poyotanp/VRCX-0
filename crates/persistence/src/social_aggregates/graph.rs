use std::collections::{BTreeMap, BTreeSet};

use crate::database::DatabaseService;
use crate::mutual_graph::mutual_graph_snapshot_get;
use crate::Error;

use super::caveats::social_graph_caveats;
use super::types::{SocialGraphEdge, SocialGraphInput, SocialGraphNode, SocialGraphOutput};

pub fn get_social_graph(
    db: &DatabaseService,
    input: SocialGraphInput,
) -> Result<SocialGraphOutput, Error> {
    let snapshot = mutual_graph_snapshot_get(db, input.owner_user_id)?;
    let focus = input
        .user_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let mut degree_by_user_id: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut edges = Vec::new();

    for friend_id in snapshot.friend_ids {
        if focus
            .as_ref()
            .is_some_and(|focus| input.depth == 0 && focus != &friend_id)
        {
            continue;
        }
        degree_by_user_id.entry(friend_id).or_default();
    }

    for link in snapshot.links {
        if let Some(focus) = &focus {
            if input.depth <= 1 && link.friend_id != *focus && link.mutual_id != *focus {
                continue;
            }
        }
        degree_by_user_id
            .entry(link.friend_id.clone())
            .or_default()
            .insert(link.mutual_id.clone());
        degree_by_user_id
            .entry(link.mutual_id.clone())
            .or_default()
            .insert(link.friend_id.clone());
        edges.push(SocialGraphEdge {
            source_user_id: link.friend_id,
            target_user_id: link.mutual_id,
        });
    }

    let nodes = degree_by_user_id
        .into_iter()
        .map(|(user_id, connections)| SocialGraphNode {
            user_id,
            connection_degree: connections.len(),
        })
        .collect();

    Ok(SocialGraphOutput {
        nodes,
        edges,
        caveats: social_graph_caveats(),
    })
}
