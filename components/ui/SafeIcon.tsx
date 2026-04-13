/**
 * SafeIcon — drop-in replacement for MaterialIcons that never crashes on Android.
 *
 * Root cause: The @expo/vector-icons Icon class calls NativeModules.ExpoFont.isLoadedNative()
 * during render. In the OnSpace Android container this native method does not exist, causing
 * a "TypeError: undefined is not a function" crash that kills the entire component tree.
 *
 * Fix: Wrap MaterialIcons in a React Error Boundary (class component). The React reconciler
 * catches the render-time error BEFORE it propagates up the tree, and we return null instead.
 *
 * IMPORTANT: The fallback must return null — NOT a View element. Passing the string 'View'
 * to React.createElement causes "View config getter callback must be a function (received
 * undefined)" on the OnSpace Android bundler because the native view registry lookup fails
 * for string-referenced components when the bridge is in a degraded state.
 */

import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface SafeIconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
}

interface State {
  hasError: boolean;
}

class SafeIcon extends React.Component<SafeIconProps, State> {
  // Expose glyphMap so usages like `keyof typeof MaterialIcons.glyphMap` still work
  static glyphMap = MaterialIcons.glyphMap;

  constructor(props: SafeIconProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    // Silently swallow — expected on Android in the OnSpace container
  }

  render() {
    if (this.state.hasError) {
      // Return null — do NOT render any View here.
      // Using React.createElement('View') or a View component causes a secondary
      // "View config getter callback must be a function" crash when the native
      // view registry is in a degraded state on the OnSpace Android container.
      return null;
    }
    return React.createElement(MaterialIcons, this.props as any);
  }
}

export { SafeIcon };
export default SafeIcon;
