// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils } from "@gtsc/cli-core";
import { I18n, Is } from "@gtsc/core";
import { EntitySchemaHelper } from "@gtsc/entity";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { IotaIdentityConnector } from "@gtsc/identity-connector-iota";
import {
	EntityStorageVaultConnector,
	VaultKey,
	VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { Command } from "commander";

/**
 * Build the verifiable credential verify command to the CLI.
 * @returns The command.
 */
export function buildCommandVerifiableCredentialVerify(): Command {
	const command = new Command();
	command
		.name("verifiable-credential-verify")
		.summary(I18n.formatMessage("commands.verifiable-credential-verify.summary"))
		.description(I18n.formatMessage("commands.verifiable-credential-verify.description"))
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-verify.options.jwt.param"),
			I18n.formatMessage("commands.verifiable-credential-verify.options.jwt.description")
		);

	CLIOptions.output(command, {
		noConsole: true,
		json: true,
		env: true,
		mergeJson: true,
		mergeEnv: true
	});

	command
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
		)
		.action(actionCommandVerifiableCredentialVerify);

	return command;
}

/**
 * Action the verifiable credential verify command.
 * @param opts The options for the command.
 * @param opts.jwt The JSON web token for the verifiable credential.
 * @param opts.console Flag to display on the console.
 * @param opts.json Output the data to a JSON file.
 * @param opts.mergeJson Merge the data to a JSON file.
 * @param opts.env Output the data to an environment file.
 * @param opts.mergeEnv Merge the data to an environment file.
 * @param opts.node The node URL.
 */
export async function actionCommandVerifiableCredentialVerify(opts: {
	jwt: string;
	console: boolean;
	json?: string;
	mergeJson: boolean;
	env?: string;
	mergeEnv: boolean;
	node: string;
}): Promise<void> {
	const jwt: string = CLIParam.stringValue("jwt", opts.jwt);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);

	CLIDisplay.value(I18n.formatMessage("commands.verifiable-credential-verify.labels.jwt"), jwt);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.break();

	const vaultConnector = new EntityStorageVaultConnector({
		vaultKeyEntityStorageConnector: new MemoryEntityStorageConnector<VaultKey>(
			EntitySchemaHelper.getSchema(VaultKey)
		),
		vaultSecretEntityStorageConnector: new MemoryEntityStorageConnector<VaultSecret>(
			EntitySchemaHelper.getSchema(VaultSecret)
		)
	});

	const requestContext = { identity: "local", tenantId: "local" };

	const iotaIdentityConnector = new IotaIdentityConnector(
		{
			vaultConnector
		},
		{
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			}
		}
	);

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-credential-verify.progress.verifyingCredential")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verification = await iotaIdentityConnector.checkVerifiableCredential(requestContext, jwt);

	const isVerified = Is.notEmpty(verification.verifiableCredential);
	const isRevoked = verification.revoked;

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-credential-verify.labels.isVerified"),
			isVerified
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-credential-verify.labels.isRevoked"),
			isRevoked
		);
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, { isVerified, isRevoked }, opts.mergeJson);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[
				`DID_VERIFIABLE_CREDENTIAL_VERIFIED="${isVerified}"`,
				`DID_VERIFIABLE_CREDENTIAL_REVOKED="${isRevoked}"`
			],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}
