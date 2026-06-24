import { describe, expect, it } from 'vitest';

import {
    buildChartOption,
    buildDetailChartOption,
    getMainChartClickedRow
} from './instanceActivityChart';
import { getLocalDayBounds } from './instanceActivityRows';

describe('instanceActivityChart', () => {
    it('builds the main chart data series from clipped visible intervals', () => {
        const selectedDate = '2024-01-02';
        const { startMs } = getLocalDayBounds(selectedDate);
        const option = buildChartOption({
            selectedDate,
            barWidth: 25,
            hour12: false,
            t: (key: any) => key,
            rows: [
                {
                    worldName: 'Known World',
                    parsedLocation: {
                        instanceName: '1',
                        accessTypeName: 'friends'
                    },
                    joinMs: startMs - 60 * 60 * 1000,
                    leaveMs: startMs + 2 * 60 * 60 * 1000,
                    visibleStartMs: startMs,
                    visibleDurationMs: 2 * 60 * 60 * 1000
                }
            ]
        });

        expect(option.yAxis.data).toEqual(['Known World']);
        expect(option.series[0].data).toEqual([0]);
        expect(option.series[1].data).toEqual([2 * 60 * 60 * 1000]);
        expect(option.series[1].itemStyle).toMatchObject({
            borderRadius: 3,
            shadowBlur: 2
        });
        expect(
            option.tooltip.formatter([{ seriesName: 'Time', dataIndex: 0 }])
        ).toContain('Known World');
    });

    it('marks the selected main chart row and resolves row activation from bar or axis clicks', () => {
        const selectedDate = '2024-01-02';
        const { startMs } = getLocalDayBounds(selectedDate);
        const rows = [
            {
                activityKey: 'wrld_one:1:1000',
                worldName: 'One',
                parsedLocation: {},
                joinMs: startMs,
                leaveMs: startMs + 1000,
                visibleStartMs: startMs,
                visibleDurationMs: 1000
            },
            {
                activityKey: 'wrld_two:1:2000',
                worldName: 'Two',
                parsedLocation: {},
                joinMs: startMs + 2000,
                leaveMs: startMs + 3000,
                visibleStartMs: startMs + 2000,
                visibleDurationMs: 1000
            }
        ];
        const option = buildChartOption({
            selectedDate,
            barWidth: 25,
            hour12: false,
            selectedActivityKey: 'wrld_two:1:2000',
            t: (key: any) => key,
            rows
        });

        expect(option.series[1].data[0]).toBe(1000);
        expect(option.series[1].data[1]).toMatchObject({
            value: 1000,
            itemStyle: {
                borderColor: expect.any(String),
                borderWidth: 2
            }
        });
        expect(
            getMainChartClickedRow(
                { componentType: 'series', seriesName: 'Time', dataIndex: 1 },
                rows
            )
        ).toBe(rows[1]);
        expect(
            getMainChartClickedRow(
                { componentType: 'yAxis', dataIndex: 0 },
                rows
            )
        ).toBe(rows[0]);
        expect(
            getMainChartClickedRow(
                {
                    componentType: 'series',
                    seriesName: 'Placeholder',
                    dataIndex: 1
                },
                rows
            )
        ).toBe(null);
    });

    it('marks detail chart rows without relying on display name lookups', () => {
        const option = buildDetailChartOption({
            barWidth: 12,
            hour12: false,
            group: [
                {
                    userId: 'usr_regular',
                    displayName: 'Same Name',
                    joinMs: 0,
                    leaveMs: 1000,
                    durationMs: 1000,
                    isCurrentUser: true,
                    isFriend: false,
                    isFavorite: false
                },
                {
                    userId: 'usr_favorite',
                    displayName: 'Same Name',
                    joinMs: 100,
                    leaveMs: 900,
                    durationMs: 800,
                    isCurrentUser: false,
                    isFriend: true,
                    isFavorite: true
                }
            ]
        });

        expect(option.yAxis.data).toEqual(['Same Name', '\u2b50 Same Name']);
        expect(option.firstEntries.map((entry: any) => entry.userId)).toEqual([
            'usr_regular',
            'usr_favorite'
        ]);
    });
});
