import React from 'react';
import { Platform } from 'react-native';

// Platform-specific icon imports
let MaterialIcons;
if (Platform.OS === 'web') {
  // Use react-icons for web (SVG-based, no font loading issues)
  const ReactIcons = require('react-icons/md');

  // Map common Material Icons to react-icons equivalents
  const iconMap = {
    'visibility': ReactIcons.MdVisibility,
    'visibility-off': ReactIcons.MdVisibilityOff,
    'add': ReactIcons.MdAdd,
    'edit': ReactIcons.MdEdit,
    'delete': ReactIcons.MdDelete,
    'save': ReactIcons.MdSave,
    'close': ReactIcons.MdClose,
    'check': ReactIcons.MdCheck,
    'arrow-back': ReactIcons.MdArrowBack,
    'search': ReactIcons.MdSearch,
    'filter-list': ReactIcons.MdFilterList,
    'qr-code': ReactIcons.MdQrCode,
    'qr-code-scanner': ReactIcons.MdQrCodeScanner,
    'notifications': ReactIcons.MdNotifications,
    'person': ReactIcons.MdPerson,
    'event': ReactIcons.MdEvent,
    'calendar-today': ReactIcons.MdCalendarToday,
    'access-time': ReactIcons.MdAccessTime,
    'download': ReactIcons.MdDownload,
    'share': ReactIcons.MdShare,
    'print': ReactIcons.MdPrint,
    'file-download': ReactIcons.MdFileDownload,
    'swap-horiz': ReactIcons.MdSwapHoriz,
    'swap-vert': ReactIcons.MdSwapVert,
    'height': ReactIcons.MdHeight,
    'straighten': ReactIcons.MdStraighten,
    'clear': ReactIcons.MdClear,
    'arrow-drop-down': ReactIcons.MdArrowDropDown,
    'more-vert': ReactIcons.MdMoreVert,
    'info': ReactIcons.MdInfo,
    'warning': ReactIcons.MdWarning,
    'error': ReactIcons.MdError,
    'check-circle': ReactIcons.MdCheckCircle,
    'cancel': ReactIcons.MdCancel,
    // Nuevos iconos añadidos para el menú
    'event-note': ReactIcons.MdEventNote,
    'add-circle-outline': ReactIcons.MdAddCircleOutline,
    'chevron-right': ReactIcons.MdChevronRight,
    'people-outline': ReactIcons.MdPeopleOutline,
    'notifications-none': ReactIcons.MdNotificationsNone,
    'settings-applications': ReactIcons.MdSettingsApplications,
    'history': ReactIcons.MdHistory,
    'person-outline': ReactIcons.MdPersonOutline,
    'date-range': ReactIcons.MdDateRange,
    'logout': ReactIcons.MdLogout,
    'menu': ReactIcons.MdMenu,
  };

  // Web Icon component wrapper
  MaterialIcons = ({ name, size = 24, color = '#000', style, ...props }) => {
    const IconComponent = iconMap[name] || ReactIcons.MdHelpOutline;
    return (
      <IconComponent
        size={size}
        color={color}
        style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
        {...props}
      />
    );
  };
} else {
  // Use @expo/vector-icons for native platforms (Android/iOS)
  const ExpoIcons = require('@expo/vector-icons');
  MaterialIcons = ExpoIcons.MaterialIcons;
}

export { MaterialIcons };
