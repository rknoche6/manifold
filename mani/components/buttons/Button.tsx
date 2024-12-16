import { FontSize, ThemedText, ThemedTextProps } from 'components/ThemedText'
import { useColor } from 'hooks/useColor'
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Text,
  TextProps,
} from 'react-native'

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
type ButtonVariant = 'primary' | 'yes' | 'no' | 'danger' // add more variants as needed

export interface ButtonProps extends TouchableOpacityProps {
  title?: string
  children?: React.ReactNode
  size?: ButtonSize
  variant?: ButtonVariant
  textProps?: ThemedTextProps
}

const sizeStyles: Record<
  ButtonSize,
  { padding: number; borderRadius: number; fontSize: FontSize }
> = {
  xs: {
    padding: 2,
    borderRadius: 4,
    fontSize: 'sm',
  },
  sm: {
    padding: 4,
    borderRadius: 4,
    fontSize: 'sm',
  },
  md: {
    padding: 8,
    borderRadius: 8,
    fontSize: 'md',
  },
  lg: {
    padding: 10,
    borderRadius: 10,
    fontSize: 'lg',
  },
}

export function Button({
  title,
  children,
  style,
  size = 'md',
  variant = 'primary',
  textProps,
  ...props
}: ButtonProps) {
  const color = useColor()

  const getButtonColors = (variant: ButtonVariant) => {
    switch (variant) {
      case 'yes':
        return {
          background: color.yesButtonBackground,
          text: color.yesButtonText,
        }
      case 'no':
        return {
          background: color.noButtonBackground,
          text: color.noButtonText,
        }
      case 'danger':
        return {
          background: color.dangerButtonBackground,
          text: color.dangerButtonText,
        }
      case 'primary':
      default:
        return {
          background: color.primaryButton,
          text: 'white',
        }
    }
  }

  const buttonColors = getButtonColors(variant)

  return (
    <TouchableOpacity
      style={[
        style,
        {
          backgroundColor: buttonColors.background,
          padding: sizeStyles[size].padding,
          borderRadius: sizeStyles[size].borderRadius,
          alignItems: 'center',
        },
      ]}
      {...props}
    >
      {title ? (
        <ThemedText
          color={buttonColors.text}
          weight="semibold"
          size={sizeStyles[size].fontSize}
          {...textProps}
        >
          {title}
        </ThemedText>
      ) : (
        children
      )}
    </TouchableOpacity>
  )
}
