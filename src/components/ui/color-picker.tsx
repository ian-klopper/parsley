'use client'

import React, { useState } from "react"
import { colorSpectrum } from "@/lib/colors"
import { useTheme } from "next-themes"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ColorPickerProps {
  onColorSelect: (colorIndex: number) => void
  currentColorIndex?: number
  trigger: React.ReactNode
}

export function ColorPicker({ onColorSelect, currentColorIndex, trigger }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const getColorValue = (index: number) => {
    const colorObj = colorSpectrum[index]
    return mounted && theme === 'dark' ? colorObj.vibrant : colorObj.pastel
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 color-picker-popover">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Choose a color</h4>
          <div className="grid grid-cols-6 gap-3">
            {colorSpectrum.map((_, index) => {
              const isSelected = currentColorIndex === index
              const colorValue = getColorValue(index)

              return (
                <button
                  key={index}
                  className={`
                    w-10 h-10 rounded-md border-2 transition-all
                    ${isSelected
                      ? 'border-primary ring-2 ring-primary ring-offset-2 scale-110'
                      : 'border-border hover:border-primary hover:scale-105'
                    }
                  `}
                  style={{ backgroundColor: colorValue }}
                  onClick={() => {
                    onColorSelect(index)
                    setOpen(false)
                  }}
                  title={`Color ${index + 1}`}
                />
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}