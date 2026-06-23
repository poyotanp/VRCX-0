import { useTranslation } from 'react-i18next';

import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Switch } from '@/ui/shadcn/switch';

import { Field, SettingsGroup } from '../SettingsField';
import { SettingsTabContent } from '../SettingsViewParts';

export function SettingsSystemTab({
    hostPlatform = 'unknown',
    isStartAtWindowsStartup,
    isStartAsMinimizedState,
    isCloseToTray,
    autoLoginDelayEnabled,
    autoLoginDelaySeconds,
    autoInstallUpdatesOnStartup,
    backgroundModeEnabled,
    onStartAtWindowsStartupChange,
    onStartAsMinimizedChange,
    onCloseToTrayChange,
    onAutoLoginDelayEnabledChange,
    onPromptAutoLoginDelaySeconds,
    onBackgroundModeEnabledChange,
    onAutoInstallUpdatesOnStartupChange,
    onProxySettings
}: any) {
    const { t } = useTranslation();
    const startupLabel =
        hostPlatform === 'linux'
            ? t('view.settings.general.application.startup_system', {
                  defaultValue: 'Start at System Startup'
              })
            : t('view.settings.general.application.startup');
    const startupDescription =
        hostPlatform === 'linux'
            ? t(
                  'view.settings.general.application.startup_system_description',
                  {
                      defaultValue:
                          'Creates a desktop autostart entry that launches VRCX-0 with --autostart.'
                  }
              )
            : '';

    return (
        <SettingsTabContent value="system">
            <SettingsGroup
                title={t('view.settings.general.application.header')}
            >
                <Field label={startupLabel} description={startupDescription}>
                    <Switch
                        checked={isStartAtWindowsStartup}
                        onCheckedChange={onStartAtWindowsStartupChange}
                    />
                </Field>
                <Field label={t('view.settings.general.application.minimized')}>
                    <Switch
                        checked={isStartAsMinimizedState}
                        onCheckedChange={onStartAsMinimizedChange}
                    />
                </Field>
                <Field
                    label={t('view.settings.general.application.tray')}
                    description={t(
                        'view.settings.general.application.tray_description'
                    )}
                >
                    <Switch
                        checked={isCloseToTray}
                        onCheckedChange={onCloseToTrayChange}
                    />
                </Field>
                <Field
                    label={t(
                        'view.settings.general.application.background_mode',
                        {
                            defaultValue:
                                'Switch to Background Mode When Minimized to Tray'
                        }
                    )}
                    description={t(
                        'view.settings.general.application.background_mode_description',
                        {
                            defaultValue:
                                'When closing VRCX-0 to the system tray, switch to Background Mode for ultra-low memory usage, around one-tenth. Some page state may reset after restore.'
                        }
                    )}
                    disabled={!isCloseToTray}
                >
                    <Switch
                        checked={backgroundModeEnabled}
                        disabled={!isCloseToTray}
                        onCheckedChange={onBackgroundModeEnabledChange}
                    />
                </Field>
                <Field
                    label={t(
                        'view.settings.general.application.auto_install_updates_on_startup'
                    )}
                    description={t(
                        'view.settings.general.application.auto_install_updates_on_startup_description'
                    )}
                >
                    <Switch
                        checked={autoInstallUpdatesOnStartup}
                        onCheckedChange={onAutoInstallUpdatesOnStartupChange}
                    />
                </Field>
                <Field
                    label={t('view.settings.general.logging.auto_login_delay')}
                >
                    <Switch
                        checked={autoLoginDelayEnabled}
                        onCheckedChange={onAutoLoginDelayEnabledChange}
                    />
                </Field>
                {autoLoginDelayEnabled ? (
                    <Field
                        label={t(
                            'view.settings.general.logging.auto_login_delay_button'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                {autoLoginDelaySeconds}
                                {t('common.time_units.s')}
                            </Badge>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onPromptAutoLoginDelaySeconds}
                            >
                                {t(
                                    'view.settings.general.logging.auto_login_delay_button'
                                )}
                            </Button>
                        </div>
                    </Field>
                ) : null}
                <Field label={t('view.settings.general.application.proxy')}>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onProxySettings}
                    >
                        {t('view.settings.general.application.proxy')}
                    </Button>
                </Field>
            </SettingsGroup>
        </SettingsTabContent>
    );
}
