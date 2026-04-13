/**
 * SafeIcon — drop-in replacement for MaterialIcons that never crashes on Android.
 *
 * Root cause: The @expo/vector-icons Icon class calls NativeModules.ExpoFont.isLoadedNative()
 * during render. In the OnSpace Android container this native method does not exist, causing
 * a "TypeError: undefined is not a function" crash that kills the entire component tree.
 *
 * Fix: Wrap MaterialIcons in a React Error Boundary (class component). The React reconciler
 * catches the render-time error BEFORE it propagates up the tree, and we return null instead.
 * This is the only interception point that actually works — JS module patching fails because
 * the Icon closure captures its broken reference at module evaluation time.
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
      // Return an invisible placeholder that preserves layout space
      const size = this.props.size ?? 24;
      return React.createElement('View' as any, {
        style: { width: size, height: size },
      });
    }
    return React.createElement(MaterialIcons, this.props as any);
  }
}

export { SafeIcon };
export default SafeIcon;
