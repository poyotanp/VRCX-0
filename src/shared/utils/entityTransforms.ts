import { replaceBioSymbols } from './string';

type EntityRecord = Record<string, unknown>;
type FavoriteCachedRef = EntityRecord & {
    id: string;
    type: string;
    favoriteId: string;
    tags: string[];
    $groupKey: string;
};

/**
 * Sanitize arbitrary entity JSON fields via replaceBioSymbols.
 * @param {object} json - Raw API response
 * @param {string[]} fields - Field names to sanitize
 * @returns {object} The mutated json
 */
export function sanitizeEntityJson(json: EntityRecord, fields: string[]) {
    for (const field of fields) {
        if (json[field]) {
            json[field] = replaceBioSymbols(json[field]);
        }
    }
    return json;
}

/**
 * Build a default favorite group ref from JSON data.
 * @param {object} json
 * @returns {object}
 */
export function createDefaultFavoriteGroupRef(json: EntityRecord = {}) {
    const tags: string[] = [];

    return {
        id: '',
        ownerId: '',
        ownerDisplayName: '',
        name: '',
        displayName: '',
        type: '',
        visibility: '',
        tags,
        ...json
    };
}

/**
 * Build a default cached favorite ref from JSON data.
 * Computes $groupKey from type and first tag.
 * @param {object} json
 * @returns {object}
 */
export function createDefaultFavoriteCachedRef(json: EntityRecord = {}) {
    const jsonTags = Array.isArray(json.tags)
        ? json.tags.map((value) => String(value))
        : [];
    const ref: FavoriteCachedRef = {
        ...json,
        id: '',
        type: '',
        favoriteId: '',
        tags: jsonTags,
        // VRCX
        $groupKey: ''
    };
    if (typeof json.id === 'string') {
        ref.id = json.id;
    }
    if (typeof json.type === 'string') {
        ref.type = json.type;
    }
    if (typeof json.favoriteId === 'string') {
        ref.favoriteId = json.favoriteId;
    }
    if (typeof json.$groupKey === 'string') {
        ref.$groupKey = json.$groupKey;
    }
    ref.$groupKey = `${ref.type}:${String(ref.tags[0])}`;
    return ref;
}
