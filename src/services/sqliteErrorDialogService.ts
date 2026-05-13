import i18n from '@/services/i18nService.js';
import { subscribeSQLiteError } from '@/shared/sqliteErrorEvents.js';
import { useModalStore } from '@/state/modalStore.js';

type SQLiteErrorCategory = 'malformed' | 'disk_full' | 'locked' | 'io_error';
type SQLiteDialogDefinition = {
    method: 'alert' | 'confirm';
    descriptionKey: string;
    titleKey: string;
};
type SQLiteErrorWithCategory = Error & {
    sqliteCategory?: unknown;
};

const SQLITE_ERROR_DIALOGS = {
    malformed: {
        method: 'confirm',
        descriptionKey:
            'repository.sqlite_repository.modal.please_repair_or_delete_your_database_file_by_fo',
        titleKey:
            'repository.sqlite_repository.modal.your_database_is_corrupted'
    },
    disk_full: {
        method: 'alert',
        descriptionKey:
            'repository.sqlite_repository.modal.disk_full_description',
        titleKey: 'repository.sqlite_repository.modal.disk_full_title'
    },
    locked: {
        method: 'alert',
        descriptionKey:
            'repository.sqlite_repository.modal.database_locked_description',
        titleKey:
            'repository.sqlite_repository.modal.database_locked_title'
    },
    io_error: {
        method: 'alert',
        descriptionKey:
            'repository.sqlite_repository.modal.disk_io_error_description',
        titleKey:
            'repository.sqlite_repository.modal.disk_io_error_title'
    }
} satisfies Record<SQLiteErrorCategory, SQLiteDialogDefinition>;

let unsubscribeSQLiteErrorListener: (() => void) | null = null;
const shownSQLiteErrors = new WeakSet<Error>();

function getSQLiteDialogDefinition(
    error: unknown
): SQLiteDialogDefinition | null {
    if (!(error instanceof Error)) {
        return null;
    }
    const category = (error as SQLiteErrorWithCategory).sqliteCategory;
    return typeof category === 'string'
        ? (SQLITE_ERROR_DIALOGS[category as SQLiteErrorCategory] ?? null)
        : null;
}

export function isKnownSQLiteError(error: unknown): boolean {
    return Boolean(getSQLiteDialogDefinition(error));
}

export async function showSQLiteErrorDialog(error: unknown): Promise<boolean> {
    if (!(error instanceof Error)) {
        return false;
    }

    const dialog = getSQLiteDialogDefinition(error);
    if (!dialog) {
        return false;
    }

    if (shownSQLiteErrors.has(error)) {
        return false;
    }
    shownSQLiteErrors.add(error);

    const modalStore = useModalStore.getState();
    try {
        await modalStore[dialog.method]({
            description: i18n.t(dialog.descriptionKey),
            title: i18n.t(dialog.titleKey)
        });
    } catch (dialogError) {
        console.warn('Failed to show SQLite error dialog:', dialogError);
        return false;
    }
    return true;
}

export function bindSQLiteErrorDialogService(): () => void {
    if (unsubscribeSQLiteErrorListener) {
        return unsubscribeSQLiteErrorListener;
    }

    unsubscribeSQLiteErrorListener = subscribeSQLiteError((error) => {
        void showSQLiteErrorDialog(error);
    });

    return () => {
        if (unsubscribeSQLiteErrorListener) {
            unsubscribeSQLiteErrorListener();
            unsubscribeSQLiteErrorListener = null;
        }
    };
}
