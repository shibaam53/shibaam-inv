import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PlaceholderPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Not built yet — planned for {phase}.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The database for this area already exists; the screen is the next step.
      </CardContent>
    </Card>
  );
}
