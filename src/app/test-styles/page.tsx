import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestStyles() {
  return (
    <div className="p-8 min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-primary">Style Test Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Card Component</CardTitle>
              <CardDescription>Testing shadcn/ui card component</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This card should have proper dark theme styling with borders and proper text colors.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-primary">Styled Card</CardTitle>
              <CardDescription>With primary border</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Color Test</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-primary p-4 rounded text-primary-foreground">Primary</div>
            <div className="bg-secondary p-4 rounded text-secondary-foreground">Secondary</div>
            <div className="bg-muted p-4 rounded text-muted-foreground">Muted</div>
            <div className="bg-accent p-4 rounded text-accent-foreground">Accent</div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Typography Test</h2>
          <div className="space-y-2">
            <p className="text-lg">Large text (text-lg)</p>
            <p className="text-base">Base text (text-base)</p>
            <p className="text-sm text-muted-foreground">Small muted text (text-sm text-muted-foreground)</p>
            <p className="font-bold">Bold text</p>
            <p className="font-semibold">Semibold text</p>
          </div>
        </div>
      </div>
    </div>
  )
}