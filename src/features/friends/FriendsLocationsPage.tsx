import { FriendsLocationsToolbar } from './components/FriendsLocationsToolbar';
import { FriendsLocationsVirtualList } from './components/FriendsLocationsVirtualList';
import { useFriendsLocationsPageController } from './useFriendsLocationsPageController';

export function FriendsLocationsPage({
    embedded = false
}: {
    embedded?: boolean;
} = {}) {
    const {
        actions,
        derived,
        filters,
        load,
        preferences,
        runtime,
        scroll
    } = useFriendsLocationsPageController();

    return (
        <div
            className={
                embedded
                    ? 'friend-view flex h-full min-h-0 flex-col p-3'
                    : 'friend-view x-container flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 pb-0'
            }
        >
            <FriendsLocationsToolbar
                activeSegment={filters.activeSegment}
                segmentOptions={derived.segmentOptions}
                searchQuery={filters.searchQuery}
                showSameInstanceInOnline={preferences.showSameInstanceInOnline}
                density={preferences.density}
                onActiveSegmentChange={filters.setActiveSegment}
                onSearchQueryChange={filters.setSearchQuery}
                onShowSameInstanceInOnlineChange={
                    preferences.changeShowSameInstanceInOnline
                }
                onDensityChange={preferences.changeDensityPreference}
            />
            {preferences.preferencesReady ? (
                <FriendsLocationsVirtualList
                    derived={derived}
                    filters={filters}
                    load={load}
                    locationCommands={actions}
                    runtime={runtime}
                    scroll={scroll}
                />
            ) : null}
        </div>
    );
}
