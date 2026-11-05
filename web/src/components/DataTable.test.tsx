import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellClass, DataTable, type Column } from "./DataTable";

interface Row {
  name: string;
  score: number;
}

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
  { key: "score", header: "Score", cell: (row) => row.score, sortValue: (row) => row.score, numeric: true },
];

const ROWS: Row[] = [
  { name: "alpha", score: 3 },
  { name: "beta", score: 9 },
];

describe("DataTable", () => {
  it("shows a title bar with its count and actions, and names the table from the title", () => {
    render(
      <DataTable
        caption="Repositories"
        headingLevel={2}
        count="2 repositories"
        actions={<button type="button">Download CSV</button>}
        description="Every scored repository."
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.name}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Repositories" })).toBeInTheDocument();
    expect(screen.getByText("2 repositories")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeInTheDocument();
    expect(screen.getByText("Every scored repository.")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Repositories" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name↕", "Score↕"]);
  });

  it("keeps a hidden caption as the name without a title bar", () => {
    render(<DataTable caption="Products" captionHidden columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Products" })).toBeInTheDocument();
  });

  it("shows an empty state inside the card, under its title", () => {
    render(
      <DataTable caption="Not started" columns={COLUMNS} rows={[]} rowKey={(row) => row.name} emptyMessage="Everyone has started." />,
    );

    expect(screen.getByRole("heading", { name: "Not started" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Everyone has started.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("scrolls in its own region when it has a maximum height", () => {
    render(<DataTable caption="Jobs" maxHeight="20rem" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />);

    const region = screen.getByRole("region", { name: "Jobs, scrollable" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.getAttribute("style")).toContain("max-height: 20rem");
  });
});

describe("cellClass", () => {
  const base = { key: "k", header: "K", cell: () => null };

  it("combines alignment, wrapping, priority and pinning", () => {
    expect(cellClass(base)).toBeUndefined();
    expect(cellClass({ ...base, numeric: true })).toBe("data-table__numeric");
    expect(cellClass({ ...base, align: "center" })).toBe("data-table__center");
    expect(cellClass({ ...base, align: "end" })).toBe("data-table__end");
    expect(cellClass({ ...base, wrap: true, priority: "secondary", sticky: true })).toBe(
      "data-table__wrap data-table__col--secondary data-table__sticky",
    );
  });
});
