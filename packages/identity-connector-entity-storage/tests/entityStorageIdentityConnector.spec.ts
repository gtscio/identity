// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { Converter, Is } from "@gtsc/core";
import { Ed25519 } from "@gtsc/crypto";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import type { IRequestContext } from "@gtsc/services";
import type { DidVerificationMethodType, IDidDocument, IDidService } from "@gtsc/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	VaultKeyDescriptor,
	VaultSecretDescriptor,
	type IVaultKey,
	type IVaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector";
import { IdentityDocumentDescriptor } from "../src/models/identityDocumentDescriptor";
import type { IIdentityDocument } from "../src/models/IIdentityDocument";

let testIdentityDocument: IIdentityDocument;
let testDocumentKey: IVaultKey;
let testDocumentVerificationMethodKey: IVaultKey;
let testDocumentVerificationMethodId: string;
let testServiceId: string;
let testProof: string;
let testVcJwt: string;
let testVpJwt: string;

/**
 * Test degree type.
 */
interface IDegree {
	/**
	 * The id.
	 */
	id: string;
	/**
	 * The name
	 */
	name: string;
	/**
	 * The degree name.
	 */
	degreeName: string;
}

let didDocumentEntityStorage: MemoryEntityStorageConnector<IIdentityDocument>;
let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<IVaultKey>;
let vaultSecretEntityStorageConnector: MemoryEntityStorageConnector<IVaultSecret>;
let vaultConnector: EntityStorageVaultConnector;

export const TEST_TENANT_ID = "test-tenant";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";

export const TEST_CONTEXT: IRequestContext = {
	tenantId: TEST_TENANT_ID,
	identity: TEST_IDENTITY_ID
};

describe("EntityStorageIdentityConnector", () => {
	beforeEach(() => {
		didDocumentEntityStorage = new MemoryEntityStorageConnector<IIdentityDocument>(
			IdentityDocumentDescriptor
		);

		vaultKeyEntityStorageConnector = new MemoryEntityStorageConnector<IVaultKey>(
			VaultKeyDescriptor
		);

		vaultSecretEntityStorageConnector = new MemoryEntityStorageConnector<IVaultSecret>(
			VaultSecretDescriptor
		);

		vaultConnector = new EntityStorageVaultConnector({
			vaultKeyEntityStorageConnector,
			vaultSecretEntityStorageConnector
		});
	});

	test("can fail to create a document with no request context", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createDocument(undefined as unknown as IRequestContext)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "requestContext",
				value: "undefined"
			}
		});
	});

	test("can create a document", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const testDocument = await identityConnector.createDocument(TEST_CONTEXT);

		const keyStore = vaultKeyEntityStorageConnector.getStore(TEST_TENANT_ID);
		testDocumentKey = keyStore?.[0] ?? ({} as IVaultKey);

		expect(testDocument.id.slice(0, 11)).toBe("did:gtsc:0x");
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toBe(`${testDocument.id}#revocation`);

		const revocationService = testDocument.service?.[0];
		expect(revocationService).toBeDefined();
		expect(revocationService?.id).toEqual(`${testDocument.id}#revocation`);
		expect(revocationService?.type).toEqual("BitstringStatusList");
		expect(revocationService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
		);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_TENANT_ID
		)?.[0] as IIdentityDocument;
	});

	test("can fail to resolve a document with no id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.resolveDocument(TEST_CONTEXT, undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can resolve a document id", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const doc = await identityConnector.resolveDocument(TEST_CONTEXT, testIdentityDocument.id);
		expect(doc.id.slice(0, 11)).toBe("did:gtsc:0x");
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toBe(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.addVerificationMethod(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with incorrect verification method type", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.addVerificationMethod(
				TEST_CONTEXT,
				"aaa",
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.arrayOneOf",
			properties: {
				property: "verificationMethodType",
				value: "undefined"
			}
		});
	});

	test("can add a verification method as assertion method", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_CONTEXT,
			testIdentityDocument.id,
			"assertionMethod",
			"my-verification-id"
		);

		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toBe(`${testIdentityDocument.id}#my-verification-id`);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_TENANT_ID
		)?.[0] as IIdentityDocument;

		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;
		expect(testDocument?.assertionMethod).toBeDefined();

		testDocumentVerificationMethodId = verificationMethod?.id ?? "";

		const keyStore = vaultKeyEntityStorageConnector.getStore(TEST_TENANT_ID);
		testDocumentVerificationMethodKey = keyStore?.[1] ?? ({} as IVaultKey);
	});

	test("can fail to remove a verification method with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.removeVerificationMethod(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.removeVerificationMethod(
				TEST_CONTEXT,
				"foo",
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can remove a verification method", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await identityConnector.removeVerificationMethod(
			TEST_CONTEXT,
			testIdentityDocument.id,
			testDocumentVerificationMethodId
		);

		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;
		expect(testDocument?.verificationMethod).toBeUndefined();
	});

	test("can fail to add a service with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.addService(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.addService(
				TEST_CONTEXT,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service type", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.addService(
				TEST_CONTEXT,
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceType",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service endpoint", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.addService(
				TEST_CONTEXT,
				"foo",
				"foo",
				"foo",
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceEndpoint",
				value: "undefined"
			}
		});
	});

	test("can add a service", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const service = await identityConnector.addService(
			TEST_CONTEXT,
			testIdentityDocument.id,
			`${testIdentityDocument.id}#linked-domain`,
			"LinkedDomains",
			"https://bar.example.com/"
		);

		expect(service).toBeDefined();
		expect(service?.type).toBe("LinkedDomains");
		expect(service?.serviceEndpoint).toBe("https://bar.example.com/");

		testServiceId = service?.id ?? "";
	});

	test("can fail to remove a service with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.removeService(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a service with no service id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.removeService(TEST_CONTEXT, "foo", undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can remove a service", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await identityConnector.removeService(TEST_CONTEXT, testIdentityDocument.id, testServiceId);

		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;

		expect(testDocument?.service).toBeDefined();

		const service = (testDocument?.service as IDidService[])?.find(
			s => s.id === `${testDocument.id}#linked-domain`
		);
		expect(service).toBeUndefined();
	});

	test("can fail to create a verifiable credential with no issuer document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no verification method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_CONTEXT,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no credential id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_CONTEXT,
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "credentialId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no schema types", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_CONTEXT,
				"foo",
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "schemaTypes",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no subject", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_CONTEXT,
				"foo",
				"foo",
				"foo",
				"UniversityDegreeCredential",
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "subject",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no revocation index", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_CONTEXT,
				"foo",
				"foo",
				"foo",
				"UniversityDegreeCredential",
				{
					id: "foo",
					name: "Alice",
					degreeName: "Bachelor of Science and Arts"
				},
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.number",
			properties: {
				property: "revocationIndex",
				value: "undefined"
			}
		});
	});

	test("can create a verifiable credential", async () => {
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentVerificationMethodKey);
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const holderDocument = await identityConnector.createDocument(TEST_CONTEXT);

		const result = await identityConnector.createVerifiableCredential(
			TEST_CONTEXT,
			testIdentityDocument.id,
			testDocumentVerificationMethodId,
			"https://example.edu/credentials/3732",
			"UniversityDegreeCredential",
			{
				id: holderDocument.id,
				name: "Alice",
				degreeName: "Bachelor of Science and Arts"
			},
			5
		);

		expect(result.verifiableCredential["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiableCredential.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential.type).toContain("UniversityDegreeCredential");

		const subject = Is.array(result.verifiableCredential.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential.credentialSubject;
		expect(subject.id.startsWith("did:gtsc")).toBeTruthy();
		expect(subject.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject.name).toEqual("Alice");
		expect(result.verifiableCredential.issuer.startsWith("did:gtsc")).toBeTruthy();
		expect(result.verifiableCredential.issuanceDate).toBeDefined();
		expect(result.verifiableCredential.credentialStatus?.id?.startsWith("did:gtsc")).toBeTruthy();
		expect(result.verifiableCredential.credentialStatus?.type).toEqual("BitstringStatusList");
		expect(result.verifiableCredential.credentialStatus?.revocationBitmapIndex).toEqual("5");
		expect(result.jwt.split(".").length).toEqual(3);

		testVcJwt = result.jwt;
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.checkVerifiableCredential<IDegree>(TEST_CONTEXT, "")
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credentialJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable credential", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const result = await identityConnector.checkVerifiableCredential<IDegree>(
			TEST_CONTEXT,
			testVcJwt
		);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiableCredential?.["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential?.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential?.type).toContain("UniversityDegreeCredential");
		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential?.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;
		expect(subject?.id.startsWith("did:gtsc")).toBeTruthy();
		expect(subject?.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject?.name).toEqual("Alice");
		expect(result.verifiableCredential?.issuer.startsWith("did:gtsc")).toBeTruthy();
		expect(result.verifiableCredential?.issuanceDate).toBeDefined();
		expect(result.verifiableCredential?.credentialStatus?.id?.startsWith("did:gtsc")).toBeTruthy();
		expect(result.verifiableCredential?.credentialStatus?.type).toEqual("BitstringStatusList");
		expect(result.verifiableCredential?.credentialStatus?.revocationBitmapIndex).toEqual("5");
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to revoke a verifiable credential with no credentialIndices", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_CONTEXT,
				testIdentityDocument.id,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can revoke a verifiable credential", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await identityConnector.revokeVerifiableCredentials(TEST_CONTEXT, testIdentityDocument.id, [5]);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_TENANT_ID
		)?.[0] as IIdentityDocument;
		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;

		expect(testDocument.service).toBeDefined();
		const revokeService = testDocument.service?.find(
			s => s.id === `${testIdentityDocument.id}#revocation`
		);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BIQEAAAACIKf4f6UzLEADAAAAAAAAAAAAAAAAAAAAvA1-s-l1AEAAAA"
		);

		const result = await identityConnector.checkVerifiableCredential<IDegree>(
			TEST_CONTEXT,
			testVcJwt
		);
		expect(result.revoked).toBeTruthy();
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to unrevoke a verifiable credential with no credentialIndices", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_CONTEXT,
				testIdentityDocument.id,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can unrevoke a verifiable credential", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await identityConnector.unrevokeVerifiableCredentials(TEST_CONTEXT, testIdentityDocument.id, [
			5
		]);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_TENANT_ID
		)?.[0] as IIdentityDocument;
		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;

		const revokeService = testDocument.service?.find(s => s.id === `${testDocument.id}#revocation`);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
		);

		const result = await identityConnector.checkVerifiableCredential<IDegree>(
			TEST_CONTEXT,
			testVcJwt
		);
		expect(result.revoked).toBeFalsy();
	});

	test("can fail to create a verifiable presentation with no holder document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "holderDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no assertion method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_CONTEXT,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "presentationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no types", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_CONTEXT,
				"foo",
				"foo",
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "schemaTypes",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no verifiable credentials", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_CONTEXT,
				"foo",
				"foo",
				["vp"],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "verifiableCredentials",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with invalid expiry", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_CONTEXT,
				"foo",
				"foo",
				["vp"],
				["jwt"],
				"foo" as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.integer",
			properties: {
				property: "expiresInMinutes",
				value: "foo"
			}
		});
	});

	test("can create a verifiable presentation", async () => {
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentVerificationMethodKey);
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const result = await identityConnector.createVerifiablePresentation(
			TEST_CONTEXT,
			testIdentityDocument.id,
			testDocumentVerificationMethodId,
			["ExamplePresentation"],
			[testVcJwt],
			14400
		);

		expect(result.verifiablePresentation["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiablePresentation.type).toEqual([
			"VerifiablePresentation",
			"ExamplePresentation"
		]);
		expect(result.verifiablePresentation.verifiableCredential).toBeDefined();
		expect(result.verifiablePresentation.verifiableCredential[0]).toEqual(testVcJwt);
		expect(result.verifiablePresentation.holder?.startsWith("did:gtsc")).toBeTruthy();
		expect(result.jwt.split(".").length).toEqual(3);
		testVpJwt = result.jwt;
	});

	test("can fail to validate a verifiable presentation with no jwt", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		await expect(
			identityConnector.checkVerifiablePresentation(TEST_CONTEXT, "")
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "presentationJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable presentation", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		const result = await identityConnector.checkVerifiablePresentation(TEST_CONTEXT, testVpJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiablePresentation?.["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiablePresentation?.type).toEqual([
			"VerifiablePresentation",
			"ExamplePresentation"
		]);
		expect(result.verifiablePresentation?.verifiableCredential).toBeDefined();
		expect(result.verifiablePresentation?.holder?.startsWith("did:gtsc")).toBeTruthy();
		expect(result.issuers).toBeDefined();
		expect(result.issuers?.length).toEqual(1);
		expect(result.issuers?.[0].id).toEqual(testIdentityDocument.id);
	});

	test("can fail to create a proof with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createProof(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no verificationMethodId", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createProof(
				TEST_CONTEXT,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no bytes", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.createProof(TEST_CONTEXT, "foo", "foo", undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "bytes",
				value: "undefined"
			}
		});
	});

	test("can create a proof", async () => {
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentVerificationMethodKey);
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const bytes = new Uint8Array([0, 1, 2, 3, 4]);
		const proof = await identityConnector.createProof(
			TEST_CONTEXT,
			testIdentityDocument.id,
			testDocumentVerificationMethodId,
			Converter.bytesToBase64(bytes)
		);
		expect(proof.type).toEqual("Ed25519");

		testProof = proof.value;

		const sig = Ed25519.sign(
			Converter.base64UrlToBytes(testDocumentVerificationMethodKey.privateKey),
			bytes
		);
		expect(proof.value).toEqual(Converter.bytesToBase64(sig));
	});

	test("can fail to verify a proof with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.verifyProof(
				TEST_CONTEXT,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no verificationMethodId", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.verifyProof(
				TEST_CONTEXT,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no bytes", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.verifyProof(
				TEST_CONTEXT,
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "bytes",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no signatureType", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.verifyProof(
				TEST_CONTEXT,
				"foo",
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "signatureType",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no signatureValue", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.verifyProof(
				TEST_CONTEXT,
				"foo",
				"foo",
				"foo",
				"foo",
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "signatureValue",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with missing document", async () => {
		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});
		await expect(
			identityConnector.verifyProof(TEST_CONTEXT, "foo", "foo", "foo", "foo", "foo")
		).rejects.toMatchObject({
			name: "GeneralError",
			inner: {
				name: "NotFoundError",
				source: "EntityStorageIdentityConnector",
				message: "entityStorageIdentityConnector.documentNotFound",
				properties: { notFoundId: "foo" }
			}
		});
	});

	test("can verify a proof", async () => {
		await didDocumentEntityStorage.set(TEST_CONTEXT, testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentKey);
		await vaultKeyEntityStorageConnector.set(TEST_CONTEXT, testDocumentVerificationMethodKey);

		const identityConnector = new EntityStorageIdentityConnector({
			didDocumentEntityStorage,
			vaultConnector
		});

		const verified = await identityConnector.verifyProof(
			TEST_CONTEXT,
			testIdentityDocument.id,
			testDocumentVerificationMethodId,
			Converter.bytesToBase64(new Uint8Array([0, 1, 2, 3, 4])),
			"Ed25519",
			testProof
		);
		expect(verified).toBeTruthy();
	});
});