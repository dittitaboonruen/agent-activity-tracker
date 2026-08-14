import HomeButton from "@/components/HomeButton";
import ThemeToggle from "@/components/ThemeToggle";

export default function PageTopBar() {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <HomeButton />

      <ThemeToggle />
    </div>
  );
}
