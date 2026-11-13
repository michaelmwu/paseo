import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { PressHighlight } from "@/components/ui/press-highlight";
import { composerPillStyles } from "@/composer/pill-styles";

interface ComposerDraftActionPillProps {
  testID: string;
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

export function ComposerDraftActionPill({
  testID,
  label,
  icon,
  onPress,
  disabled = false,
}: ComposerDraftActionPillProps) {
  const [isHovered, setIsHovered] = useState(false);
  const handleHoverIn = useCallback(() => setIsHovered(true), []);
  const handleHoverOut = useCallback(() => setIsHovered(false), []);
  const bodyStyle = useMemo(
    () => [composerPillStyles.body, isHovered && composerPillStyles.bodyActive],
    [isHovered],
  );
  const labelStyle = useMemo(
    () => [composerPillStyles.label, isHovered && composerPillStyles.labelActive],
    [isHovered],
  );

  return (
    <PressHighlight
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      style={bodyStyle}
    >
      {icon}
      <Text style={labelStyle} numberOfLines={1}>
        {label}
      </Text>
    </PressHighlight>
  );
}
