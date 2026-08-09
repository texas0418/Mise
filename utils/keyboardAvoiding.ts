import { Platform } from 'react-native';

/**
 * Behavior for the KeyboardAvoidingView that wraps every data-entry form.
 *
 * iOS needs explicit padding; Android handles this itself via
 * windowSoftInputMode. Hoisted out of the components because as an inline
 * ternary it counted against each screen's cyclomatic complexity budget.
 */
export const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? ('padding' as const) : undefined;
