import "server-only";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ContractDocument } from "@/lib/contract-template";

/**
 * Rendu PDF du contrat.
 *
 * Même source que l'écran : `buildContractDocument` produit des clauses
 * structurées, ce module les met en page. Aucun texte n'est réécrit ici — si
 * une clause change, elle change aux deux endroits à la fois.
 *
 * Le PDF est généré à la demande depuis le snapshot figé, jamais stocké : le
 * snapshot EST l'archive, et régénérer donne toujours le même document.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontSize: 10,
    lineHeight: 1.6,
    color: "#3f3f46",
    fontFamily: "Helvetica",
  },
  eyebrow: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: "#a1a1aa",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 18, color: "#18181b", fontFamily: "Helvetica-Bold", lineHeight: 1.3 },
  reference: { fontSize: 9, color: "#71717a", marginTop: 4, fontFamily: "Courier" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#e4e4e7", marginTop: 14, marginBottom: 18 },
  notice: {
    backgroundColor: "#fafafa",
    borderLeftWidth: 2,
    borderLeftColor: "#d4d4d8",
    padding: 8,
    marginTop: 12,
    fontSize: 8.5,
    color: "#52525b",
  },
  clause: { marginBottom: 14 },
  clauseTitle: {
    fontSize: 11,
    color: "#18181b",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  paragraph: { marginBottom: 4, textAlign: "justify" },
  bold: { fontFamily: "Helvetica-Bold", color: "#18181b" },
  signatures: { flexDirection: "row", gap: 12, marginTop: 18 },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
    padding: 10,
  },
  signatureLabel: { fontSize: 7, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.8 },
  signatureName: { fontSize: 10, color: "#18181b", fontFamily: "Helvetica-Bold", marginTop: 4 },
  signatureDate: { fontSize: 8.5, color: "#71717a", marginTop: 3 },
  footer: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e4e4e7" },
  footerText: { fontSize: 7.5, color: "#71717a", marginBottom: 3, lineHeight: 1.5 },
  pageNumber: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 7.5,
    color: "#a1a1aa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/** Restitue le gras `**...**` du modèle en segments stylés. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={styles.paragraph}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <Text key={i} style={styles.bold}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

function dateTimeFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ContractPdf({
  doc,
  brandSignedAt,
  creatorSignedAt,
  terminatedAt,
}: {
  doc: ContractDocument;
  brandSignedAt: string | null;
  creatorSignedAt: string | null;
  terminatedAt: string | null;
}) {
  const brandName =
    doc.parties.brand.legal_name || doc.parties.brand.display_name;
  const creatorName =
    doc.parties.creator.legal_name || doc.parties.creator.display_name;

  return (
    <Document
      title={`Contrat ${doc.reference}`}
      author="Collabbs"
      subject="Contrat de collaboration commerciale"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Contrat de collaboration commerciale</Text>
        <Text style={styles.title}>
          {brandName} × {creatorName}
        </Text>
        <Text style={styles.reference}>{doc.reference}</Text>

        {doc.regime === "simplified" && (
          <Text style={styles.notice}>
            Forme simplifiée — la rémunération cumulée entre ces deux parties sur
            l&apos;année civile n&apos;atteint pas 1 000 EUR HT, seuil à partir duquel
            la loi impose un contrat écrit détaillé.
          </Text>
        )}
        {terminatedAt && (
          <Text style={styles.notice}>
            Contrat résilié le {dateTimeFr(terminatedAt)}.
          </Text>
        )}

        <View style={styles.rule} />

        {doc.clauses.map((c) => (
          <View key={c.number} style={styles.clause} wrap={false}>
            <Text style={styles.clauseTitle}>
              Article {c.number} — {c.title}
            </Text>
            {c.paragraphs.map((p, i) => (
              <Rich key={i} text={p} />
            ))}
          </View>
        ))}

        <View wrap={false}>
          <Text style={styles.clauseTitle}>Signatures</Text>
          <View style={styles.signatures}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Pour l&apos;annonceur</Text>
              <Text style={styles.signatureName}>
                {doc.parties.brand.rep_name || brandName}
              </Text>
              <Text style={styles.signatureDate}>
                Signé le {dateTimeFr(brandSignedAt)}
              </Text>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Pour le créateur</Text>
              <Text style={styles.signatureName}>
                {doc.parties.creator.rep_name || creatorName}
              </Text>
              <Text style={styles.signatureDate}>
                Signé le {dateTimeFr(creatorSignedAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {doc.footer.map((f, i) => (
            <Text key={i} style={styles.footerText}>
              {f.replace(/\*\*/g, "")}
            </Text>
          ))}
        </View>

        <View style={styles.pageNumber} fixed>
          <Text>{doc.reference}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Génère le fichier PDF prêt à être servi. */
export async function renderContractPdf(params: {
  doc: ContractDocument;
  brandSignedAt: string | null;
  creatorSignedAt: string | null;
  terminatedAt: string | null;
}): Promise<Buffer> {
  return renderToBuffer(<ContractPdf {...params} />);
}
