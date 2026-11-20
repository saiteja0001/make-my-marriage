"use client";

import { useState, type ChangeEvent, type CompositionEvent } from "react";
import { capitalizeFirstLetter } from "@/modules/wedding/wedding-text";

type TextControl = HTMLInputElement | HTMLTextAreaElement;

export function useWeddingTextInput<Field extends string>(updateField: (name: Field, value: string) => void) {
  const [composition, setComposition] = useState<{ field: Field; initialValue: string } | null>(null);

  function textInput(name: Field, previousValue: string, maxLength: number) {
    function applyCapitalization(control: TextControl, priorValue: string) {
      const { value, selectionStart, selectionEnd, selectionDirection } = control;
      const capitalized = /\p{L}/u.test(priorValue) ? value : capitalizeFirstLetter(value);
      // Uppercasing can expand some letters. Keep every character within the field limit.
      if (capitalized === value || capitalized.length > maxLength) {
        updateField(name, value);
        return;
      }

      control.value = capitalized;
      if (selectionStart !== null && selectionEnd !== null) {
        control.setSelectionRange(
          capitalizeFirstLetter(value.slice(0, selectionStart)).length,
          capitalizeFirstLetter(value.slice(0, selectionEnd)).length,
          selectionDirection ?? "none",
        );
      }
      updateField(name, capitalized);
    }

    return {
      autoCapitalize: "none",
      maxLength,
      onChange: ({ currentTarget, nativeEvent }: ChangeEvent<TextControl>) => {
        if (composition?.field === name || ("isComposing" in nativeEvent && nativeEvent.isComposing)) {
          updateField(name, currentTarget.value);
        } else {
          applyCapitalization(currentTarget, previousValue);
        }
      },
      onCompositionStart: ({ currentTarget }: CompositionEvent<TextControl>) => {
        setComposition({ field: name, initialValue: currentTarget.value });
      },
      onCompositionEnd: ({ currentTarget }: CompositionEvent<TextControl>) => {
        const priorValue = composition?.field === name ? composition.initialValue : previousValue;
        setComposition(null);
        applyCapitalization(currentTarget, priorValue);
      },
    };
  }

  return { textInput, resetComposition: () => setComposition(null) };
}
