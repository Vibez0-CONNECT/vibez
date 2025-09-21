# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }:
{
  # Which nixpkgs channel to use.
  channel = "stable-24.05";

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
  ];

  # Sets environment variables in the workspace
  env = {
    GMAIL_EMAIL = "invincibleshinmen@gmail.com"; # Ensure this is your correct email
    GMAIL_PASSWORD = "qzyl czow daei xabj"; # !!! IMPORTANT: Replace with your actual App Password if 2FA is enabled !!!
  };

  idx = {
    # This is the correct, nested structure for previews.
    previews = {
      enable = true;
      previews = {
        # You can name this preview anything, e.g., "web"
        web = {
          command = ["npm", "run", "dev", "--prefix", "vibez"];
          manager = "web";
        };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = "npm install --prefix vibez";
      };
      # The dev server is started by the preview command.
      onStart = {};
    };
  };
}
