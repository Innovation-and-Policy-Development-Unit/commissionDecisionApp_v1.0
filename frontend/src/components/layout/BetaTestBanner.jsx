import React from 'react';
import { 
  Text, 
  Button, 
  makeStyles, 
  shorthands, 
  tokens 
} from '@fluentui/react-components';
import { 
  InfoRegular, 
  DismissRegular, 
  ChatRegular 
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';

const useStyles = makeStyles({
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '12px',
    backgroundColor: tokens.colorNeutralBackgroundInverted,
    color: tokens.colorNeutralForegroundInverted,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '40px',
    zIndex: 100,
    ...shorthands.padding(0, tokens.spacingHorizontalL),
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      rowGap: '4px',
      height: 'auto',
      paddingTop: '8px',
      paddingBottom: '8px',
    },
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
  },
  actionButton: {
    color: tokens.colorNeutralForegroundInverted,
    ...shorthands.borderColor(tokens.colorNeutralForegroundInverted),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: tokens.colorNeutralForegroundInverted,
      ...shorthands.borderColor(tokens.colorNeutralForegroundInverted),
    },
    ':hover:active': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    }
  }
});

/**
 * High-visibility banner for Staging/Beta environments.
 * Encourages managers to use the Feedback tool.
 */
export default function BetaTestBanner() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { toggleFeedbackPanel, feedbackEnabled } = useTheme();
  
  // You can tie this to an env variable like VITE_APP_ENV === 'staging'
  const isBeta = true; 

  if (!isBeta) return null;

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.content}>
        <InfoRegular fontSize={20} />
        <Text weight="semibold">
          {t('beta.banner_title', 'SCDMS STAGING ENVIRONMENT')}
        </Text>
        <Text size={200}>
          {t('beta.banner_desc', 'This is a test system. Please do not enter real sensitive data.')}
        </Text>
      </div>
      
      {feedbackEnabled && (
        <Button 
          size="small" 
          appearance="outline" 
          icon={<ChatRegular />}
          className={styles.actionButton}
          onClick={toggleFeedbackPanel}
        >
          {t('beta.provide_feedback', 'Provide Feedback')}
        </Button>
      )}
    </div>
  );
}
