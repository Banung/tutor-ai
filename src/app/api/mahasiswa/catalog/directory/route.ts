import { NextRequest, NextResponse } from "next/server";
import { requireMahasiswa } from "@/lib/api-utils";
import { listMahasiswaCatalogDirectory } from "@/lib/services/mahasiswa.service";

export async function GET(request: NextRequest) {
  const { error } = await requireMahasiswa(request);
  if (error) return error;

  try {
    const directory = await listMahasiswaCatalogDirectory();
    return NextResponse.json(directory);
  } catch (err) {
    console.error("[mahasiswa.catalog.directory] unexpected error", err);
    return NextResponse.json(
      { error: "Gagal memuat direktori fakultas dan program studi" },
      { status: 500 }
    );
  }
}
