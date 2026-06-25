import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { generateDashboardRowId } from '@/repositories/dashboardRepository';

import { cloneDashboardRows } from './dashboardConfig';

export function useDashboardEditorState({
    consumeEditingDashboardId,
    dashboard,
    loaded,
    saveDashboard
}: any) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editRows, setEditRows] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    function resetEditDraft() {
        setEditName(dashboard?.name || '');
        setEditRows(cloneDashboardRows(dashboard?.rows));
    }

    useEffect(() => {
        if (!dashboard) {
            setIsEditing(false);
            setEditName('');
            setEditRows([]);
            return;
        }

        resetEditDraft();
    }, [dashboard]);

    useEffect(() => {
        if (!loaded || !dashboard?.id) {
            return;
        }

        if (consumeEditingDashboardId(dashboard.id)) {
            setIsEditing(true);
            return;
        }

        setIsEditing(false);
    }, [consumeEditingDashboardId, dashboard?.id, loaded]);

    const handleAddRow = (panelCount: any, direction: any = 'horizontal') => {
        setEditRows((current: any) => [
            ...current,
            {
                id: generateDashboardRowId(),
                direction,
                panels: Array.from({ length: panelCount }, () => null)
            }
        ]);
    };

    const handleUpdatePanel = (
        rowIndex: any,
        panelIndex: any,
        nextPanel: any
    ) => {
        setEditRows((current: any) =>
            current.map((row: any, currentRowIndex: any) => {
                if (currentRowIndex !== rowIndex) {
                    return row;
                }

                const panels = Array.isArray(row?.panels)
                    ? row.panels.slice(0, 2)
                    : [];
                panels[panelIndex] = nextPanel;
                return {
                    ...row,
                    panels
                };
            })
        );
    };

    const handleRemovePanel = (rowIndex: any, panelIndex: any) => {
        setEditRows((current: any) =>
            current
                .map((row: any, currentRowIndex: any) => {
                    if (currentRowIndex !== rowIndex) {
                        return row;
                    }

                    const panels = Array.isArray(row?.panels)
                        ? row.panels.slice(0, 2)
                        : [];
                    panels.splice(panelIndex, 1);
                    return {
                        ...row,
                        panels
                    };
                })
                .filter(
                    (row: any) =>
                        Array.isArray(row?.panels) && row.panels.length > 0
                )
        );
    };

    const handleRemoveRow = (rowIndex: any) => {
        setEditRows((current: any) =>
            current.filter((_: any, index: any) => index !== rowIndex)
        );
    };

    const handleDirectionChange = (rowIndex: any, direction: any) => {
        setEditRows((current: any) =>
            current.map((row: any, index: any) =>
                index === rowIndex
                    ? {
                          ...row,
                          direction:
                              direction === 'vertical'
                                  ? 'vertical'
                                  : 'horizontal'
                      }
                    : row
            )
        );
    };

    const handleSave = async () => {
        if (!dashboard) {
            return;
        }

        setIsSaving(true);
        try {
            await saveDashboard(dashboard.id, {
                name:
                    editName.trim() ||
                    dashboard.name ||
                    t('dashboard.default_name'),
                rows: editRows
            });
            setIsEditing(false);
            toast.success(t('view.dashboard.success.dashboard_saved'));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('view.dashboard.toast.failed_to_save_dashboard')
            );
        } finally {
            setIsSaving(false);
        }
    };

    function cancelEditing() {
        setIsEditing(false);
        resetEditDraft();
    }

    return {
        cancelEditing,
        editName,
        editRows,
        handleAddRow,
        handleDirectionChange,
        handleRemovePanel,
        handleRemoveRow,
        handleSave,
        handleUpdatePanel,
        isEditing,
        isSaving,
        setEditName,
        setIsEditing
    };
}
