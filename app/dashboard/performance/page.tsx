async function loadData() {
  setLoading(true);
  setError("");

  try {
    const response = await fetch(
      "/api/monthly-performance",
      {
        cache: "no-store",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      setRows([]);

      setError(
        data.error ||
          "ไม่สามารถโหลดข้อมูล Monthly Performance ได้"
      );

      return;
    }

    setRows(
      data.rows ?? []
    );
  } catch (error) {
    console.error(
      "[monthly-performance-page] load error:",
      error
    );

    setRows([]);

    setError(
      "เกิดข้อผิดพลาดในการโหลด Monthly Performance"
    );
  } finally {
    setLoading(false);
  }
}
