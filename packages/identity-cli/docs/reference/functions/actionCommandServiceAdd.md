# Function: actionCommandServiceAdd()

> **actionCommandServiceAdd**(`opts`): `Promise`\<`void`\>

Action the service add command.

## Parameters

• **opts**

The options for the command.

• **opts.seed**: `string`

The private key for the controller.

• **opts.did**: `string`

The identity of the document to add to.

• **opts.id**: `string`

The id of the service to add.

• **opts.type**: `string`

The type of the service to add.

• **opts.endpoint**: `string`

The service endpoint.

• **opts.console**: `boolean`

Flag to display on the console.

• **opts.json?**: `string`

Output the data to a JSON file.

• **opts.mergeJson**: `boolean`

Merge the data to a JSON file.

• **opts.env?**: `string`

Output the data to an environment file.

• **opts.mergeEnv**: `boolean`

Merge the data to an environment file.

• **opts.node**: `string`

The node URL.

• **opts.explorer**: `string`

The explorer URL.

## Returns

`Promise`\<`void`\>