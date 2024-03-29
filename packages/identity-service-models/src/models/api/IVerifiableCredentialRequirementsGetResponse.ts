// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityClaimRequirement } from "../service/IIdentityClaimRequirement";

/**
 * Response to get the requirements for a verifiable credential.
 */
export interface IVerifiableCredentialRequirementsGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * Verifiable credential applications must match the users email domain.
		 */
		matchDomains?: string;

		/**
		 * The requisites needed to apply for a verifiable credential.
		 */
		requiredClaims?: IIdentityClaimRequirement[];
	};
}
