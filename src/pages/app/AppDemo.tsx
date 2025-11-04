import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

const AppDemo = () => {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Interactive Demo</h1>
          <p className="text-muted-foreground text-lg">Coming soon in Phase 4</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Demo Mode</CardTitle>
            <CardDescription>Experience FleetTrackMate with sample data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/20 rounded-lg p-12 flex flex-col items-center justify-center text-center border border-border">
              <Play className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                The interactive demo will showcase:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Real-time vehicle tracking simulation</li>
                <li>• Sample fleet management workflows</li>
                <li>• Analytics and reporting features</li>
                <li>• Multi-role user experience</li>
              </ul>
            </div>
            
            <Button className="w-full" disabled>
              Start Demo (Coming in Phase 4)
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AppDemo;
